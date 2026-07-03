import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireExtensionToken } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { captureFinalizeSchema } from '@/lib/validators';
import { analyzeScreenshot, generateStepDescription, generateDraft, extractCoverColors, detectPII, cleanTranscripts } from '@/lib/ai/claude';
import { buildCaptureAnnotationLabel, buildCaptureFallbackDraft, buildCaptureFallbackTutorialTitle, cleanCaptureTypeText, isLowQualityCaptureLabel, isLowQualityCaptureScript, isLowQualityCaptureTitle, isUsableCaptureDraft, type CaptureFallbackActionInfo } from '@/lib/ai/capture-fallback';
import { resolveFavicon } from '@/lib/favicon';
import { buildClickHighlight } from '@/lib/annotations';
import { transcribeAudio, assignSegmentsToSteps, computeStepWindows } from '@/lib/voice/voice';
import { logSystem } from '@/lib/logging/logger-server';

async function fetchScreenshotForAi(url: string): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' } | null> {
  if (url.startsWith('data:')) {
    const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i.exec(url);
    if (!match) {
      console.warn('capture finalize screenshot data URL parse failed');
      return null;
    }
    return {
      base64: match[2],
      mediaType: match[1].toLowerCase() as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
    };
  }

  const res = await fetch(url);
  if (!res.ok) {
    console.warn('capture finalize screenshot fetch failed:', { status: res.status, url });
    return null;
  }

  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const)
    .find(type => contentType.includes(type)) ?? 'image/jpeg';
  const buffer = await res.arrayBuffer();
  return {
    base64: Buffer.from(buffer).toString('base64'),
    mediaType,
  };
}

function cleanActionInfoForDraft(actionInfo: CaptureFallbackActionInfo): CaptureFallbackActionInfo {
  if (!actionInfo) return actionInfo;
  return {
    ...actionInfo,
    label: isLowQualityCaptureLabel(actionInfo.label) ? undefined : actionInfo.label,
    text: isLowQualityCaptureLabel(actionInfo.text) ? undefined : actionInfo.text,
  };
}

type GuideStepType =
  | 'normal_interactive_step'
  | 'visual_only_step'
  | 'visual_overlay_step'
  | 'manual_capture_step'
  | 'blocked_step'
  | 'skipped_step';

const GUIDE_STEP_TYPES = new Set<string>([
  'normal_interactive_step',
  'visual_only_step',
  'visual_overlay_step',
  'manual_capture_step',
  'blocked_step',
  'skipped_step',
]);

function normalizeStepType(value: unknown): GuideStepType | null {
  return typeof value === 'string' && GUIDE_STEP_TYPES.has(value)
    ? value as GuideStepType
    : null;
}

function classifyStepType(
  ev: Record<string, unknown>,
  noAction: boolean,
  hasTarget: boolean,
  hasScreenshot: boolean,
): GuideStepType {
  const explicit = normalizeStepType(ev.step_type);
  if (explicit && explicit !== 'normal_interactive_step') return explicit;
  if ((ev.capture_source as string | null) === 'manual' && hasScreenshot) return 'manual_capture_step';
  if (!hasScreenshot) return 'blocked_step';
  if (noAction || !hasTarget) return 'visual_only_step';
  return 'normal_interactive_step';
}

function blockedStepMessage(reason: unknown): string {
  if (reason === 'upload_failed') {
    return '자동 캡처를 저장하지 못한 단계입니다. 실제 화면에서 필요한 작업을 완료한 뒤 다음을 눌러주세요.';
  }
  return '이 단계는 보안 정책이나 브라우저 제한으로 자동 캡처되지 않았습니다. 화면 안내에 따라 직접 진행한 뒤 다음을 눌러주세요.';
}

function isMissingExceptionStepColumns(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === '42703'
    || /step_type|capture_source|capture_failure_reason/i.test(error?.message ?? '');
}

function stripExceptionStepColumns<T extends Record<string, unknown>>(steps: T[]): T[] {
  return steps.map(step => {
    const next = { ...step };
    delete next.step_type;
    delete next.capture_source;
    delete next.capture_failure_reason;
    return next;
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();
  const userId = auth.userId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = captureFinalizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { session_id, title, step_numbers, content_mode = 'action', auto_zoom = false, audio_url = null, step_voice } = parsed.data;

  // 세션 소유자 확인
  const { data: session } = await supabase
    .from('mm_capture_sessions')
    .select('id, status')
    .eq('id', session_id)
    .eq('user_id', userId)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.status !== 'active') {
    return NextResponse.json({ error: 'Session already finalized' }, { status: 409 });
  }

  // 캡처 이벤트 조회 — step_number(행동 순서) 우선, 없으면 created_at(저장 순서) 폴백.
  // created_at만 쓰면 업로드 완료 순서로 뒤섞여 1-3-2 순서 버그 발생.
  const { data: events } = await supabase
    .from('mm_capture_events')
    .select('*')
    .eq('session_id', session_id)
    .order('step_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (!events || events.length === 0) {
    return NextResponse.json({ error: 'No captured steps' }, { status: 422 });
  }

  // recorder가 살아남은 스텝 번호를 전달한 경우 — 패널에서 삭제/실행취소된 스텝 제외.
  // step_number는 save-step에서 필수값이므로 null 이벤트도 엄격히 제외한다
  // (느슨하게 유지하면 삭제된 스텝이 매뉴얼에 다시 포함되는 누수 발생).
  const liveEvents = step_numbers?.length
    ? events.filter(ev => ev.step_number != null && step_numbers.includes(ev.step_number))
    : events;

  if (liveEvents.length === 0) {
    return NextResponse.json({ error: 'No captured steps' }, { status: 422 });
  }

  // 무료 플랜 여부 확인 (어노테이션 생성 제한)

  // TODO: 정식 서비스 전 플랜별 한도 복구 (daily_limit 체크 비활성화 중)

  // 중복 이벤트 제거:
  //   1) 동일 screenshot_url 연속 → 첫 번째만 유지
  //   2) 동일 page_url + created_at 차이 500ms 미만 연속 → 마지막만 유지 (타이핑 덮어쓰기)
  //   3) screenshot_url 없는 이벤트 제거
  const deduped = liveEvents.filter((ev, i, arr) => {
    const prev = arr[i - 1];
    if (!prev) return true;
    // 동일 screenshot_url 연속 제거 (첫 번째 유지)
    if (ev.screenshot_url && ev.screenshot_url === prev.screenshot_url) return false;
    // 동일 page_url이고 500ms 이내 연속 — 마지막만 유지 (i+1이 같은 조건이면 현재는 제거)
    const next = arr[i + 1];
    const tCur  = new Date(ev.created_at).getTime();
    const tPrev = new Date(prev.created_at).getTime();
    if (
      ev.url === prev.url &&
      tCur - tPrev < 500 &&
      next && next.url === ev.url &&
      new Date(next.created_at).getTime() - tCur < 500
    ) return false;
    return true;
  });

  // 튜토리얼 생성
  // Actual title is updated after AI draft generation.
  const tutorialTitle = title ?? '새 매뉴얼';
  const { data: tutorial, error: tutError } = await supabase
    .from('mm_tutorials')
    .insert({
      user_id: userId,
      title: tutorialTitle,
      session_id,
      content_mode,
      status: 'draft',
      visibility: 'private',
      share_token: null,
      published_at: null,
    })
    .select('id')
    .single();

  if (tutError || !tutorial) {
    return NextResponse.json({ error: 'Failed to create tutorial' }, { status: 500 });
  }

  // favicon 보완: 호스트명별로 한 번만 resolveFavicon 호출 (중복 요청 방지)
  const faviconCache = new Map<string, string | null>();
  await Promise.all(
    Array.from(new Set(deduped.map(ev => ev.domain_hostname).filter(Boolean))).map(async hostname => {
      if (!hostname) return;
      const sample = deduped.find(ev => ev.domain_hostname === hostname);
      const resolved = await resolveFavicon(sample?.domain_favicon, hostname, sample?.url).catch(() => null);
      faviconCache.set(hostname, resolved);
    })
  );

  // element_rect(0~1 정규화)로 crop_rect 계산 — 요소 크기에 따라 동적 패딩, 최소 크기 보장
  function calcCropRect(
    rect: { x: number; y: number; width: number; height: number } | null,
    clickX?: number | null,
    clickY?: number | null,
  ) {
    if (!rect) return null;

    // 요소가 작을수록 더 넓은 패딩 (컨텍스트 확보)
    const size = Math.max(rect.width, rect.height);
    const PAD = size < 0.05 ? 0.15 : size > 0.3 ? 0.05 : 0.10;

    const MIN_W = 0.35;
    const MIN_H = 0.25;

    let cx = rect.x + rect.width / 2;
    let cy = rect.y + rect.height / 2;
    // click_x/y가 유효하면 crop 중심을 클릭 지점으로
    if (clickX != null && clickX > 0 && clickY != null && clickY > 0) {
      cx = clickX;
      cy = clickY;
    }

    const w = Math.max(rect.width + PAD * 2, MIN_W);
    const h = Math.max(rect.height + PAD * 2, MIN_H);
    const x = Math.max(0, Math.min(1 - w, cx - w / 2));
    const y = Math.max(0, Math.min(1 - h, cy - h / 2));
    return { x, y, width: Math.min(1 - x, w), height: Math.min(1 - y, h) };
  }

  // '선택영역 확대' — 클릭/요소 영역이 크게 보이도록 image_zoom + offset을 선적용한다.
  // 원본 이미지는 그대로이므로(표시 변환만) 편집기 줌/팬 도구로 언제든 되돌릴 수 있다.
  // 표시 변환(editor/play): translate(ox*100%, oy*100%) scale(z), origin center
  //   → 이미지 정규좌표 c가 화면 중앙에 오려면 offset = z * (0.5 - c)
  function calcZoomFraming(
    rect: { x: number; y: number; width: number; height: number } | null,
    clickX?: number | null,
    clickY?: number | null,
  ) {
    const MAX_AUTO_ZOOM = 1.6;
    // 확대 중심 — 클릭 지점 우선, 없으면 요소 중심
    let cx: number | null = null;
    let cy: number | null = null;
    if (clickX != null && clickY != null && (clickX > 0 || clickY > 0)) {
      cx = clickX;
      cy = clickY;
    } else if (rect) {
      cx = rect.x + rect.width / 2;
      cy = rect.y + rect.height / 2;
    }
    if (cx == null || cy == null) return null; // 좌표 없음 (navigate/autoNav) → 확대 안 함

    // 배율 — 가독성 우선. 큰 요소는 확대 안 하고, 작을수록 약하게만 확대 (자동 확대 상한 1.5)
    let zoom = 1.4;
    if (rect) {
      const size = Math.max(rect.width, rect.height);
      zoom = size > 0.4 ? 1.0 : size > 0.2 ? 1.35 : 1.5;
    }
    zoom = Math.min(MAX_AUTO_ZOOM, zoom);
    if (zoom <= 1.0) return null; // 충분히 큰 요소 → 전체 화면 그대로 유지(가독성)

    // 확대 후 보이는 창(1/zoom)이 이미지 밖으로 나가지 않게 중심 클램프
    const half = 1 / (2 * zoom);
    const ccx = Math.min(1 - half, Math.max(half, cx));
    const ccy = Math.min(1 - half, Math.max(half, cy));

    return {
      image_zoom: zoom,
      image_offset_x: Math.round(zoom * (0.5 - ccx) * 1000) / 1000,
      image_offset_y: Math.round(zoom * (0.5 - ccy) * 1000) / 1000,
    };
  }

  // Recorder가 캡처 시 결정한 확대 영역(crop_box, 원본 0~1) → image_zoom/offset 프레이밍으로 변환.
  // 서버 휴리스틱(calcZoomFraming) 대신 사용. 표시 변환은 calcZoomFraming과 동일(center origin scale+translate).
  function framingFromCropBox(box: { x: number; y: number; width: number; height: number } | null) {
    const MAX_AUTO_ZOOM = 1.6;
    if (!box) return null;
    const w = Math.min(Math.max(box.width, 0.001), 1);
    const h = Math.min(Math.max(box.height, 0.001), 1);
    const z = Math.min(MAX_AUTO_ZOOM, Math.max(1, 1 / Math.max(w, h))); // 큰 변 기준 가득 채움
    if (z <= 1.001) return null; // 거의 전체 → 확대 안 함(가독성)
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const half = 1 / (2 * z);
    const ccx = Math.min(1 - half, Math.max(half, cx));
    const ccy = Math.min(1 - half, Math.max(half, cy));
    return {
      image_zoom: Math.round(z * 1000) / 1000,
      image_offset_x: Math.round(z * (0.5 - ccx) * 1000) / 1000,
      image_offset_y: Math.round(z * (0.5 - ccy) * 1000) / 1000,
    };
  }

  // '행동 없음' 판정 — 빈영역 클릭/전체선택/페이지 이동/캡처는 특정 클릭 대상이 없으므로
  // 가짜 '클릭 X' 설명·하이라이트·핫스팟을 만들지 않는다(편집 #1·#3, 따라하기 #2). 사용자가 수동으로 넣게.
  const noActionByStepNum = new Map<number, boolean>();

  // 캡처 이벤트 → mm_steps 변환
  const steps = deduped.map((ev, idx) => {
    const rawRect = (ev.element_rect as { x: number; y: number; width: number; height: number } | null) ?? null;
    let clickX = ev.click_x != null ? ev.click_x / 10000 : null;
    let clickY = ev.click_y != null ? ev.click_y / 10000 : null;

    const sel = (ev.element_selector as string | null) ?? null;
    const hasGoodSelector = !!sel && !/^\s*(html|body)\s*$/i.test(sel.trim());
    const hasClick = (clickX != null && clickX > 0.001) || (clickY != null && clickY > 0.001);
    const hugeRect = !!rawRect && rawRect.width >= 0.7 && rawRect.height >= 0.7;
    // 행동 없음: 클릭 좌표가 없거나(이동/캡처), 또는 좋은 셀렉터 없이 화면 전체에 가까운/없는 영역(빈영역/전체선택)
    const noAction = !hasClick || (!hasGoodSelector && (hugeRect || !rawRect));
    noActionByStepNum.set(idx + 1, noAction);
    const hasScreenshot = !!ev.screenshot_url;
    const hasTarget = hasGoodSelector || !!rawRect || hasClick;
    const stepType = classifyStepType(ev as Record<string, unknown>, noAction, hasTarget, hasScreenshot);
    const explanationOnly = stepType !== 'normal_interactive_step';

    // 행동 없음 → 핫스팟/어노테이션/줌 근거(좌표·영역) 제거. 셀렉터는 향후 Guide Me 위해 유지.
    if (noAction || explanationOnly) { clickX = null; clickY = null; }
    const elementRect = noAction || explanationOnly ? null : rawRect;
    // 캡처 단계 확대: Recorder가 보낸 crop_box 우선(있으면 서버 휴리스틱 대체). 행동 없음 스텝은 확대 안 함.
    const cropBox = noAction ? null : ((ev.crop_box as { x: number; y: number; width: number; height: number } | null) ?? null);
    const recorderFraming = framingFromCropBox(cropBox);
    const zoomFraming = recorderFraming ?? (auto_zoom ? calcZoomFraming(elementRect, clickX, clickY) : null);
    return {
      tutorial_id: tutorial.id,
      step_number: idx + 1,
      order_index: idx,
      screenshot_url: ev.screenshot_url ?? null,
      page_url:        ev.url,
      ai_title:        ev.ai_title        ?? (stepType === 'blocked_step' ? '수동으로 진행할 단계' : null),
      ai_description:  ev.ai_description  ?? (stepType === 'blocked_step' ? blockedStepMessage(ev.capture_failure_reason) : null),
      step_type:       stepType,
      capture_source:  ev.capture_source ?? (hasScreenshot ? 'auto' : 'none'),
      capture_failure_reason: ev.capture_failure_reason ?? null,
      domain_hostname: ev.domain_hostname ?? null,
      domain_name:     ev.domain_name     ?? null,
      domain_favicon:  ev.domain_hostname
        ? (faviconCache.get(ev.domain_hostname) ?? ev.domain_favicon ?? null)
        : (ev.domain_favicon ?? null),
      click_x:           clickX,
      click_y:           clickY,
      element_rect:      elementRect,
      element_selector:  explanationOnly ? null : (ev.element_selector  ?? null),
      element_xpath:     explanationOnly ? null : (ev.element_xpath     ?? null),
      follow_config:     explanationOnly ? { kind: 'none' } : null,
      // crop_box(캡처 확대)가 있으면 image_zoom로 프레이밍하므로 crop_rect는 비움(렌더 경로 일관성).
      crop_rect:         cropBox ? null : calcCropRect(elementRect, clickX, clickY),
      // 캡처 시 실제 입력된 텍스트 — 라이브 가이드 자동입력 폴백용
      type_text:         cleanCaptureTypeText(ev.type_text as string | null),
      ...(zoomFraming ?? {}),
    };
  });

  let { error: stepsError } = await supabase
    .from('mm_steps')
    .insert(steps);

  if (isMissingExceptionStepColumns(stepsError)) {
    const retry = await supabase
      .from('mm_steps')
      .insert(stripExceptionStepColumns(steps));
    stepsError = retry.error;
  }

  if (stepsError) {
    // 롤백: 생성한 튜토리얼 삭제
    await supabase.from('mm_tutorials').delete().eq('id', tutorial.id);
    return NextResponse.json({ error: 'Failed to create steps' }, { status: 500 });
  }

  // 녹화 완료 즉시 자동 게시 — 편집 없이 매뉴얼 상세 페이지로 바로 이동
  const shareToken = randomBytes(16).toString('hex');
  await supabase
    .from('mm_tutorials')
    .update({
      status: 'published',
      visibility: 'public',
      share_token: shareToken,
      published_at: new Date().toISOString(),
    })
    .eq('id', tutorial.id);

  // 세션 완료 처리는 필수. daily_manual_count 증가는 운영 DB에 RPC가 늦게
  // 적용된 경우에도 매뉴얼 생성을 막지 않도록 best-effort로 처리한다.
  const sessionUpdate = await supabase
    .from('mm_capture_sessions')
    .update({ status: 'completed', ended_at: new Date().toISOString(), audio_url: audio_url ?? null })
    .eq('id', session_id);

  if (sessionUpdate.error) {
    await supabase.from('mm_tutorials').delete().eq('id', tutorial.id);
    return NextResponse.json({ error: 'Failed to finalize session' }, { status: 500 });
  }

  const countUpdate = await supabase.rpc('increment_daily_manual_count', { uid: userId });
  if (countUpdate.error) {
    console.warn('capture finalize daily count update failed:', countUpdate.error.message);
  }

  // staging 정리 — 매뉴얼 변환이 끝난 세션의 mm_capture_events 행과,
  // 매뉴얼에 포함되지 않은(패널 삭제/중복 제거) 고아 스크린샷을 삭제한다.
  // 포함된 이미지는 mm_steps.screenshot_url이 같은 파일을 가리키므로 건드리지 않는다.
  try {
    const usedUrls = new Set(steps.map(s => s.screenshot_url));
    const STORAGE_PREFIX = '/storage/v1/object/public/naviaction/';
    const orphanPaths = events
      .filter(ev => ev.screenshot_url && !usedUrls.has(ev.screenshot_url))
      .map(ev => {
        const url = ev.screenshot_url as string;
        const i = url.indexOf(STORAGE_PREFIX);
        return i >= 0 ? decodeURIComponent(url.slice(i + STORAGE_PREFIX.length)) : null;
      })
      .filter((p): p is string => !!p);
    if (orphanPaths.length) {
      await supabase.storage.from('naviaction').remove(orphanPaths);
    }
    await supabase.from('mm_capture_events').delete().eq('session_id', session_id);
  } catch {
    /* 정리 실패는 무시 — cron 청소가 보완 */
  }

  try {
    const { data: initialSteps } = await supabase
      .from('mm_steps')
      .select('id, step_number, ai_title, ai_description, page_url, screenshot_url, domain_name, element_rect, click_x, click_y, user_annotations')
      .eq('tutorial_id', tutorial.id)
      .order('step_number', { ascending: true });

    if (initialSteps?.length) {
      const actionInfoByStepNum = new Map<number, CaptureFallbackActionInfo>();
      const elementTextByStepNum = new Map<number, string | null>();
      const actionTypeByStepNum = new Map<number, string>();
      deduped.forEach((ev, idx) => {
        actionInfoByStepNum.set(idx + 1, cleanActionInfoForDraft((ev.action_info as CaptureFallbackActionInfo) ?? null));
        const elementText = (ev.element_text as string | null) ?? null;
        elementTextByStepNum.set(idx + 1, isLowQualityCaptureLabel(elementText) ? null : elementText);
        actionTypeByStepNum.set(idx + 1, ((ev.action_info as { type?: string } | null)?.type ?? 'click'));
      });

      const drafts = initialSteps.map(step => buildCaptureFallbackDraft(step, {
        noAction: noActionByStepNum.get(step.step_number) ?? false,
        actionInfo: actionInfoByStepNum.get(step.step_number),
        elementText: elementTextByStepNum.get(step.step_number),
      }));
      const draftsById = new Map(drafts.map(draft => [draft.id, draft]));
      const firstStep = initialSteps[0];
      const firstAiPatch: Record<string, string> = {};

      if (firstStep) {
        const fallback = draftsById.get(firstStep.id);
        let firstTitle = fallback?.user_title || firstStep.ai_title || '';
        let firstScript = fallback?.user_script || firstStep.ai_description || '';

        if (firstStep.screenshot_url) {
          try {
            const image = await fetchScreenshotForAi(firstStep.screenshot_url);
            if (image) {
              const event = deduped[(firstStep.step_number ?? 1) - 1];
              const noAction = noActionByStepNum.get(firstStep.step_number) ?? false;
              const clickX = !noAction && event?.click_x != null ? event.click_x / 10000 : undefined;
              const clickY = !noAction && event?.click_y != null ? event.click_y / 10000 : undefined;
              const analysis = await analyzeScreenshot(
                image.base64,
                firstStep.page_url ?? '',
                actionInfoByStepNum.get(firstStep.step_number) ?? undefined,
                { clickX, clickY },
                image.mediaType
              ).catch(() => null);

              if (analysis?.title?.trim() && !isLowQualityCaptureTitle(analysis.title)) {
                firstTitle = analysis.title.trim();
                firstAiPatch.ai_title = firstTitle;
              }

              const generated = firstTitle
                ? await generateStepDescription(firstTitle, firstStep.page_url, image.base64, image.mediaType).catch(() => '')
                : '';
              if (generated.trim() && !isLowQualityCaptureScript(generated)) {
                firstScript = generated.trim();
                firstAiPatch.ai_description = firstScript;
              }
            }
          } catch {
            /* First card AI polish is best-effort; fallback text is already ready. */
          }
        }

        draftsById.set(firstStep.id, {
          id: firstStep.id,
          user_title: firstTitle || fallback?.user_title || '',
          user_script: firstScript || fallback?.user_script || '',
        });
      }

      const fallbackTutorialTitle = buildCaptureFallbackTutorialTitle(Array.from(draftsById.values()));
      if (fallbackTutorialTitle) {
        await supabase.from('mm_tutorials').update({ title: fallbackTutorialTitle }).eq('id', tutorial.id);
      }

      await Promise.all(initialSteps.map(async step => {
        const draft = draftsById.get(step.id);
        const isFirst = firstStep?.id === step.id;
        const patch: Record<string, unknown> = {};
        const titleDraft = draft?.user_title?.trim() || step.ai_title || `Step ${step.step_number}`;
        if (titleDraft) patch.user_title = titleDraft;
        if (isFirst) {
          patch.user_script = draft?.user_script?.trim() || step.ai_description || null;
          Object.assign(patch, firstAiPatch);
        }

        const existingAnnotations = Array.isArray(step.user_annotations) ? step.user_annotations : [];
        if (isFirst && existingAnnotations.length === 0) {
          const rect = step.element_rect as { x: number; y: number; width: number; height: number } | null;
          const actionType = actionTypeByStepNum.get(step.step_number) ?? 'click';
          const label = buildCaptureAnnotationLabel(String(patch.user_title ?? step.ai_title ?? ''), actionType, step.page_url);
          const num = step.step_number ?? 1;
          if (rect) {
            patch.user_annotations = buildClickHighlight({ elementRect: rect, stepNumber: num, label, clickX: step.click_x, clickY: step.click_y, actionType });
          } else if (step.click_x != null && step.click_y != null && (step.click_x > 0 || step.click_y > 0)) {
            const estimatedRect = {
              x: Math.max(0, step.click_x - 0.05),
              y: Math.max(0, step.click_y - 0.02),
              width: Math.min(0.10, 1 - Math.max(0, step.click_x - 0.05)),
              height: Math.min(0.04, 1 - Math.max(0, step.click_y - 0.02)),
            };
            patch.user_annotations = buildClickHighlight({ elementRect: estimatedRect, stepNumber: num, label, clickX: step.click_x, clickY: step.click_y, actionType });
          }
        }

        if (Object.keys(patch).length > 0) {
          await supabase
            .from('mm_steps')
            .update(patch)
            .eq('id', step.id)
            .eq('tutorial_id', tutorial.id);
        }
      }));

      await logSystem('capture.finalize.initial_ready', {
        userId,
        tutorialId: tutorial.id,
        sessionId: session_id,
        stepCount: initialSteps.length,
        firstCardPolished: !!firstAiPatch.ai_title || !!firstAiPatch.ai_description,
      }, 'info');
    }
  } catch (err) {
    console.error('capture finalize initial draft generation error:', err);
  }

  // The editor now fills remaining descriptions incrementally after the first card is visible.
  const runFullDraftBeforeResponse = process.env.CAPTURE_FINALIZE_BLOCKING_AI === '1';
  if (runFullDraftBeforeResponse) {
  // AI 초안 생성 — tutorial 제목 + 스텝별 user_title/user_script + 커버 색상
  try {
    const { data: createdSteps } = await supabase
      .from('mm_steps')
      .select('id, step_number, ai_title, ai_description, page_url, screenshot_url, domain_name')
      .eq('tutorial_id', tutorial.id)
      .order('step_number', { ascending: true });

    if (createdSteps?.length) {
      const actionInfoByStepNum = new Map<number, CaptureFallbackActionInfo>();
      const elementTextByStepNum = new Map<number, string | null>();
      deduped.forEach((ev, idx) => {
        actionInfoByStepNum.set(idx + 1, cleanActionInfoForDraft((ev.action_info as CaptureFallbackActionInfo) ?? null));
        const elementText = (ev.element_text as string | null) ?? null;
        elementTextByStepNum.set(idx + 1, isLowQualityCaptureLabel(elementText) ? null : elementText);
      });

      const enrichedSteps = [];
      for (const step of createdSteps) {
        const existingAiTitle = step.ai_title?.trim() || null;
        const existingAiDescription = step.ai_description?.trim() || null;
        const existingTitleUsable = !!existingAiTitle && !isLowQualityCaptureTitle(existingAiTitle);
        const existingDescriptionUsable = !!existingAiDescription && !isLowQualityCaptureScript(existingAiDescription);
        if ((existingTitleUsable && existingDescriptionUsable) || !step.screenshot_url) {
          enrichedSteps.push(step);
          continue;
        }

        try {
          const image = await fetchScreenshotForAi(step.screenshot_url);
          if (!image) {
            await logSystem('capture.finalize.screenshot_unavailable', {
              userId,
              tutorialId: tutorial.id,
              sessionId: session_id,
              stepNumber: step.step_number,
              reason: 'image_fetch_or_data_url_failed',
            }, 'warn');
            enrichedSteps.push(step);
            continue;
          }

          const event = deduped[step.step_number - 1];
          const noAction = noActionByStepNum.get(step.step_number) ?? false;
          const clickX = !noAction && event?.click_x != null ? event.click_x / 10000 : undefined;
          const clickY = !noAction && event?.click_y != null ? event.click_y / 10000 : undefined;
          const actionInfo = actionInfoByStepNum.get(step.step_number) ?? undefined;
          const analysis = existingTitleUsable
            ? null
            : await analyzeScreenshot(
                image.base64,
                step.page_url ?? '',
                actionInfo,
                { clickX, clickY },
                image.mediaType
              ).catch(async (err) => {
                console.error('capture finalize step title retry error:', err);
                await logSystem('capture.finalize.step_title_ai_failed', {
                  userId,
                  tutorialId: tutorial.id,
                  sessionId: session_id,
                  stepNumber: step.step_number,
                  reason: err instanceof Error ? err.message : String(err),
                }, 'warn');
                return null;
              });

          const aiTitle = existingTitleUsable ? existingAiTitle : analysis?.title?.trim() || null;
          const aiDescription = existingDescriptionUsable
            ? existingAiDescription
            : (aiTitle
                ? await generateStepDescription(aiTitle, step.page_url, image.base64, image.mediaType).catch(async (err) => {
                    console.error('capture finalize step description retry error:', err);
                    await logSystem('capture.finalize.step_description_ai_failed', {
                      userId,
                      tutorialId: tutorial.id,
                      sessionId: session_id,
                      stepNumber: step.step_number,
                      reason: err instanceof Error ? err.message : String(err),
                    }, 'warn');
                    return null;
                  })
                : null);

          if (aiTitle || aiDescription) {
            await supabase
              .from('mm_steps')
              .update({
                ai_title: aiTitle ?? step.ai_title,
                ai_description: aiDescription ?? step.ai_description,
              })
              .eq('id', step.id);
          }

          enrichedSteps.push({
            ...step,
            ai_title: aiTitle ?? step.ai_title,
            ai_description: aiDescription ?? step.ai_description,
          });
        } catch (err) {
          console.error('capture finalize step analysis retry error:', err);
          await logSystem('capture.finalize.step_ai_analysis_failed', {
            userId,
            tutorialId: tutorial.id,
            sessionId: session_id,
            stepNumber: step.step_number,
            reason: err instanceof Error ? err.message : String(err),
          }, 'warn');
          enrichedSteps.push(step);
        }
      }

      // 첫 스크린샷 base64 fetch (커버 색상 추출용)
      let coverColors: { color1: string; color2: string } | null = null;
      const firstScreenshotUrl = enrichedSteps[0]?.screenshot_url;
      if (firstScreenshotUrl) {
        try {
          const imgRes = await fetch(firstScreenshotUrl);
          if (imgRes.ok) {
            const ct = imgRes.headers.get('content-type') ?? 'image/jpeg';
            const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const)
              .find(t => ct.includes(t)) ?? 'image/jpeg';
            const buf = await imgRes.arrayBuffer();
            const b64 = Buffer.from(buf).toString('base64');
            coverColors = await extractCoverColors(b64, mediaType);
          }
        } catch { /* 색상 추출 실패 무시 */ }
      }

      // Always save usable fallback drafts. AI can improve them, but an AI
      // failure must not leave a generated manual with empty titles/scripts.
      let tutorial_title = '';
      let drafts: Array<{ id: string; user_title: string; user_script: string }> = enrichedSteps.map(step => {
        const fallback = buildCaptureFallbackDraft(step, {
          noAction: noActionByStepNum.get(step.step_number) ?? false,
          actionInfo: actionInfoByStepNum.get(step.step_number),
          elementText: elementTextByStepNum.get(step.step_number),
        });
        return fallback;
      });
      let fallbackTutorialTitle = buildCaptureFallbackTutorialTitle(drafts);
      let aiDraftStatus = 'not_called';
      let discardedAiDrafts = 0;

      try {
        const draftResult = await generateDraft(
          enrichedSteps.map(s => {
            const actionInfo = actionInfoByStepNum.get(s.step_number);
            return {
              ...s,
              ai_title: isLowQualityCaptureTitle(s.ai_title) ? null : s.ai_title,
              ai_description: isLowQualityCaptureScript(s.ai_description) ? null : s.ai_description,
              noAction: noActionByStepNum.get(s.step_number) ?? false,
              action_type: actionInfo?.type ?? null,
              action_label: actionInfo?.label ?? actionInfo?.text ?? null,
              element_text: elementTextByStepNum.get(s.step_number) ?? null,
            };
          })
        );
        aiDraftStatus = draftResult.status;
        tutorial_title = draftResult.tutorial_title;
        const aiDraftsById = new Map(draftResult.steps.map(d => [d.id, d]));
        drafts = enrichedSteps.map(step => {
          const fallback = buildCaptureFallbackDraft(step, {
            noAction: noActionByStepNum.get(step.step_number) ?? false,
            actionInfo: actionInfoByStepNum.get(step.step_number),
            elementText: elementTextByStepNum.get(step.step_number),
          });
          const aiDraft = aiDraftsById.get(step.id);
          const aiTitle = aiDraft?.user_title?.trim() || '';
          const aiScript = aiDraft?.user_script?.trim() || '';
          const useAiDraft = isUsableCaptureDraft(aiDraft, { pageUrl: step.page_url });
          if (aiDraft && !useAiDraft) discardedAiDrafts += 1;
          return {
            id: step.id,
            user_title: useAiDraft ? aiTitle : fallback.user_title,
            user_script: useAiDraft ? aiScript : fallback.user_script,
          };
        });
        fallbackTutorialTitle = buildCaptureFallbackTutorialTitle(drafts);
        if (draftResult.status !== 'ok') {
          await logSystem('capture.finalize.ai_draft_failed', {
            userId,
            tutorialId: tutorial.id,
            sessionId: session_id,
            status: draftResult.status,
            reason: draftResult.reason ?? null,
            responsePreview: draftResult.responsePreview ?? null,
            fallbackOnly: true,
          }, 'warn');
        } else if (discardedAiDrafts > 0) {
          await logSystem('capture.finalize.ai_draft_low_quality_discarded', {
            userId,
            tutorialId: tutorial.id,
            sessionId: session_id,
            discardedAiDrafts,
            fallbackOnly: discardedAiDrafts === enrichedSteps.length,
          }, 'warn');
        } else {
          await logSystem('capture.finalize.ai_draft_ok', {
            userId,
            tutorialId: tutorial.id,
            sessionId: session_id,
            aiSteps: draftResult.steps.length,
            fallbackOnly: false,
          }, 'info');
        }
      } catch (err) {
        console.error('capture finalize ai draft generation error:', err);
        aiDraftStatus = 'exception';
        await logSystem('capture.finalize.ai_draft_exception', {
          userId,
          tutorialId: tutorial.id,
          sessionId: session_id,
          reason: err instanceof Error ? err.message : String(err),
          fallbackOnly: true,
        }, 'warn');
      }

      const emptyTitles = drafts.filter(d => !d.user_title.trim()).length;
      const emptyScripts = drafts.filter(d => !d.user_script.trim()).length;
      const fallbackOnly = aiDraftStatus !== 'ok' || discardedAiDrafts === enrichedSteps.length;
      await logSystem('capture.finalize.draft_summary', {
        userId,
        tutorialId: tutorial.id,
        sessionId: session_id,
        aiDraftStatus,
        fallbackOnly,
        discardedAiDrafts,
        emptyTitles,
        emptyScripts,
      }, emptyTitles || emptyScripts ? 'warn' : 'info');

      // tutorial 제목 + cover_color 업데이트
      const tutorialUpdate: Record<string, string> = {};
      const safeTutorialTitle = !isLowQualityCaptureTitle(tutorial_title) ? tutorial_title : '';
      if (safeTutorialTitle || fallbackTutorialTitle) tutorialUpdate.title = safeTutorialTitle || fallbackTutorialTitle;
      if (coverColors) tutorialUpdate.cover_color = `${coverColors.color1},${coverColors.color2}`;
      if (Object.keys(tutorialUpdate).length > 0) {
        await supabase.from('mm_tutorials').update(tutorialUpdate).eq('id', tutorial.id);
      }

      // 스텝 초안 업데이트
      if (drafts.length) {
        const allowedIds = new Set(enrichedSteps.map(s => s.id));
        const safeDrafts = drafts.filter(d => allowedIds.has(d.id));
        await Promise.all(
          safeDrafts.map(d => {
            const patch: Record<string, string> = {
              user_title: d.user_title,
              user_script: d.user_script,
            };
            return supabase
              .from('mm_steps')
              .update(patch)
              .eq('id', d.id)
              .eq('tutorial_id', tutorial.id);
          })
        );
      }

      // 자동 어노테이션 생성 — 무료 플랜은 생략
      {
        // deduped 순서 = step_number - 1, action_info.type으로 라벨 분기
        const actionTypeByStepNum = new Map<number, string>();
        deduped.forEach((ev, idx) => {
          const t = (ev.action_info as { type?: string } | null)?.type ?? 'click';
          actionTypeByStepNum.set(idx + 1, t);
        });

        const { data: stepsForAnnotation } = await supabase
          .from('mm_steps')
          .select('id, step_number, user_title, ai_title, page_url, element_rect, click_x, click_y, user_annotations')
          .eq('tutorial_id', tutorial.id);

        if (stepsForAnnotation?.length) {
          await Promise.allSettled(
            stepsForAnnotation.map(async (step) => {
              if (Array.isArray(step.user_annotations) && step.user_annotations.length > 0) return;

              const rect = step.element_rect as { x: number; y: number; width: number; height: number } | null;
              const actionType = actionTypeByStepNum.get(step.step_number) ?? 'click';
              const label = buildCaptureAnnotationLabel(step.user_title ?? step.ai_title, actionType, step.page_url);
              const num = step.step_number ?? 1;
              let annotations;

              if (rect) {
                annotations = buildClickHighlight({ elementRect: rect, stepNumber: num, label, clickX: step.click_x, clickY: step.click_y, actionType });
              } else if (step.click_x != null && step.click_y != null && (step.click_x > 0 || step.click_y > 0)) {
                const estimatedRect = {
                  x: Math.max(0, step.click_x - 0.05),
                  y: Math.max(0, step.click_y - 0.02),
                  width:  Math.min(0.10, 1 - Math.max(0, step.click_x - 0.05)),
                  height: Math.min(0.04, 1 - Math.max(0, step.click_y - 0.02)),
                };
                annotations = buildClickHighlight({ elementRect: estimatedRect, stepNumber: num, label, clickX: step.click_x, clickY: step.click_y, actionType });
              } else {
                return;
              }

              await supabase
                .from('mm_steps')
                .update({ user_annotations: annotations })
                .eq('id', step.id);
            })
          );
        }
      }
    }
  } catch (err) {
    console.error('capture finalize draft generation error:', err);
    // 초안/어노테이션 생성 실패는 무시 — 튜토리얼은 정상 생성됨
  }
  }

  // 음성 → 스텝별 설명. 주력은 '연속 내레이션'(audio_url): Whisper 전사 후 캡처 시각
  // (audio_offset_ms) 기준으로 스텝에 배분. per-step 보정(step_voice)이 있으면 그 스텝은
  // 해당 클립으로 덮어쓴다. 다듬은 문장은 user_script(에디터 자동 로드), 원문은 voice_transcript_raw.
  const runVoiceBeforeResponse = process.env.CAPTURE_FINALIZE_BLOCKING_VOICE === '1';
  if (runVoiceBeforeResponse && (audio_url || (step_voice && Object.keys(step_voice).length))) {
    try {
      const rawByStep = new Map<number, string>();          // mm step_number → 전사 원문
      const urlByStep = new Map<number, string>();          // mm step_number → 재생용 오디오 URL
      const windowByStep = new Map<number, { start_ms: number; end_ms: number }>();

      // 1) 연속 내레이션 — 타임스탬프 구간 배분
      if (audio_url) {
        const segments = await transcribeAudio(audio_url).catch(() => []);
        if (segments.length) {
          const stepOffsets = deduped.map((ev, idx) => ({
            step_number: idx + 1,
            offset_ms: (ev.audio_offset_ms as number | null) ?? null,
          }));
          const byStep = assignSegmentsToSteps(segments, stepOffsets);
          byStep.forEach((raw, sn) => { rawByStep.set(sn, raw); urlByStep.set(sn, audio_url); });
          const totalMs = Math.round(Math.max(...segments.map(s => s.end)) * 1000);
          computeStepWindows(stepOffsets, totalMs).forEach((w, sn) => windowByStep.set(sn, w));
        }
      }

      // 2) per-step 보정 — 해당 스텝만 개별 클립으로 덮어씀 (recorder stepNumber → idx+1)
      if (step_voice && Object.keys(step_voice).length) {
        const overrides: Array<{ mmStep: number; url: string }> = [];
        deduped.forEach((ev, idx) => {
          const sn = ev.step_number as number | null;
          const url = sn != null ? step_voice[String(sn)] : undefined;
          if (url) overrides.push({ mmStep: idx + 1, url });
        });
        await Promise.allSettled(overrides.map(async ({ mmStep, url }) => {
          const segs = await transcribeAudio(url).catch(() => []);
          const raw = segs.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
          if (raw) rawByStep.set(mmStep, raw);
          urlByStep.set(mmStep, url);
          windowByStep.delete(mmStep);  // 개별 클립은 전체 재생 (구간 없음)
        }));
      }

      if (rawByStep.size || urlByStep.size) {
        const cleanedByStep = await cleanTranscripts(
          Array.from(rawByStep.entries()).map(([step_number, raw]) => ({ step_number, raw }))
        ).catch(() => new Map<number, string>());

        const { data: voiceSteps } = await supabase
          .from('mm_steps')
          .select('id, step_number')
          .eq('tutorial_id', tutorial.id);

        if (voiceSteps?.length) {
          await Promise.allSettled(
            voiceSteps.map(async (step) => {
              const url = urlByStep.get(step.step_number);
              if (!url) return;
              const raw = rawByStep.get(step.step_number) || null;
              const cleaned = (raw && cleanedByStep.get(step.step_number)) || raw || null;
              const win = windowByStep.get(step.step_number);
              await supabase
                .from('mm_steps')
                .update({
                  ...(cleaned ? { user_script: cleaned } : {}),
                  voice_transcript_raw: raw,
                  voice_audio_url:      url,
                  voice_audio_start_ms: win?.start_ms ?? null,
                  voice_audio_end_ms:   win?.end_ms ?? null,
                })
                .eq('id', step.id);
            })
          );
        }
      }
    } catch (err) {
      console.error('voice transcription error:', err);
      // 전사 실패는 무시 — 매뉴얼은 정상 생성됨
    }
  }

  // PII 검사 — 응답 블로킹 없이 백그라운드 실행
  void (async () => {
    try {
      const { data: stepsForPII } = await supabase
        .from('mm_steps')
        .select('id, screenshot_url')
        .eq('tutorial_id', tutorial.id);

      if (!stepsForPII?.length) return;

      await Promise.allSettled(
        stepsForPII.map(async (step) => {
          if (!step.screenshot_url) return;
          try {
            const imgRes = await fetch(step.screenshot_url);
            if (!imgRes.ok) return;
            const ct = imgRes.headers.get('content-type') ?? 'image/jpeg';
            const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const)
              .find(t => ct.includes(t)) ?? 'image/jpeg';
            const b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
            const hasPII = await detectPII(b64, mediaType);
            if (hasPII) {
              await supabase.from('mm_steps').update({ pii_detected: true }).eq('id', step.id);
            }
          } catch { /* 개별 스텝 실패 무시 */ }
        })
      );
    } catch { /* PII 검사 전체 실패 무시 */ }
  })();

  return NextResponse.json({
    tutorial_id: tutorial.id,
    step_count: steps.length,
    share_token: shareToken,
    completion_pending: true,
  });
}

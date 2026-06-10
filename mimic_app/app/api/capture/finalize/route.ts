import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { captureFinalizeSchema } from '@/lib/validators';
import { generateDraft, extractCoverColors, detectPII } from '@/lib/claude';
import { resolveFavicon } from '@/lib/favicon';
import { buildClickHighlight } from '@/lib/annotations';

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

  const { session_id, title } = parsed.data;

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
  if (session.status === 'completed') {
    return NextResponse.json({ error: 'Session already finalized' }, { status: 409 });
  }

  // 캡처 이벤트 조회 (created_at 기준 정렬 — timestamp 컬럼 없음)
  const { data: events } = await supabase
    .from('mm_capture_events')
    .select('*')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  if (!events || events.length === 0) {
    return NextResponse.json({ error: 'No captured steps' }, { status: 422 });
  }

  // TODO: 정식 서비스 전 플랜별 한도 복구 (daily_limit 체크 비활성화 중)

  // 중복 이벤트 제거:
  //   1) 동일 screenshot_url 연속 → 첫 번째만 유지
  //   2) 동일 page_url + created_at 차이 500ms 미만 연속 → 마지막만 유지 (타이핑 덮어쓰기)
  //   3) screenshot_url 없는 이벤트 제거
  const deduped = events.filter((ev, i, arr) => {
    if (!ev.screenshot_url) return false;
    const prev = arr[i - 1];
    if (!prev) return true;
    // 동일 screenshot_url 연속 제거 (첫 번째 유지)
    if (ev.screenshot_url === prev.screenshot_url) return false;
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
  const tutorialTitle = title ?? `매뉴얼 ${new Date().toLocaleDateString('ko-KR')}`;
  const { data: tutorial, error: tutError } = await supabase
    .from('mm_tutorials')
    .insert({
      user_id: userId,
      title: tutorialTitle,
      session_id,
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

  // 캡처 이벤트 → mm_steps 변환
  const steps = deduped.map((ev, idx) => {
    const elementRect = (ev.element_rect as { x: number; y: number; width: number; height: number } | null) ?? null;
    return {
      tutorial_id: tutorial.id,
      step_number: idx + 1,
      order_index: idx,
      screenshot_url: ev.screenshot_url,
      page_url:        ev.url,
      ai_title:        ev.ai_title        ?? null,
      ai_description:  ev.ai_description  ?? null,
      domain_hostname: ev.domain_hostname ?? null,
      domain_name:     ev.domain_name     ?? null,
      domain_favicon:  ev.domain_hostname
        ? (faviconCache.get(ev.domain_hostname) ?? ev.domain_favicon ?? null)
        : (ev.domain_favicon ?? null),
      click_x:           ev.click_x != null ? ev.click_x / 10000 : null,
      click_y:           ev.click_y != null ? ev.click_y / 10000 : null,
      element_rect:      elementRect,
      element_selector:  ev.element_selector  ?? null,
      element_xpath:     ev.element_xpath     ?? null,
      crop_rect:         calcCropRect(
        elementRect,
        ev.click_x != null ? ev.click_x / 10000 : null,
        ev.click_y != null ? ev.click_y / 10000 : null,
      ),
    };
  });

  const { error: stepsError } = await supabase
    .from('mm_steps')
    .insert(steps);

  if (stepsError) {
    // 롤백: 생성한 튜토리얼 삭제
    await supabase.from('mm_tutorials').delete().eq('id', tutorial.id);
    return NextResponse.json({ error: 'Failed to create steps' }, { status: 500 });
  }

  // 세션 완료 처리 + daily_manual_count atomic 증가 (병렬, RPC로 race condition 방지)
  await Promise.all([
    supabase
      .from('mm_capture_sessions')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', session_id),
    supabase.rpc('increment_daily_manual_count', { uid: userId }),
  ]);

  // AI 초안 생성 — tutorial 제목 + 스텝별 user_title/user_script + 커버 색상
  try {
    const { data: createdSteps } = await supabase
      .from('mm_steps')
      .select('id, step_number, ai_title, ai_description, page_url, screenshot_url, domain_name')
      .eq('tutorial_id', tutorial.id)
      .order('step_number', { ascending: true });

    if (createdSteps?.length) {
      // 첫 스크린샷 base64 fetch (커버 색상 추출용)
      let coverColors: { color1: string; color2: string } | null = null;
      const firstScreenshotUrl = createdSteps[0]?.screenshot_url;
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

      // draft 생성 (tutorial 제목 + 스텝 초안 동시 생성)
      const { tutorial_title, steps: drafts } = await generateDraft(createdSteps);

      // tutorial 제목 + cover_color 업데이트
      const tutorialUpdate: Record<string, string> = {};
      if (tutorial_title) tutorialUpdate.title = tutorial_title;
      if (coverColors) tutorialUpdate.cover_color = `${coverColors.color1},${coverColors.color2}`;
      if (Object.keys(tutorialUpdate).length > 0) {
        await supabase.from('mm_tutorials').update(tutorialUpdate).eq('id', tutorial.id);
      }

      // 스텝 초안 업데이트
      if (drafts.length) {
        const allowedIds = new Set(createdSteps.map(s => s.id));
        const safeDrafts = drafts.filter(d => allowedIds.has(d.id));
        await Promise.all(
          safeDrafts.map(d =>
            supabase
              .from('mm_steps')
              .update({ user_title: d.user_title })
              .eq('id', d.id)
              .eq('tutorial_id', tutorial.id)
          )
        );
      }

      // 자동 어노테이션 생성 — element_rect 있으면 하이라이트, click_x/y만 있으면 원형 마커
      // user_annotations가 이미 있는 스텝은 건너뜀 (유저 수정 덮어쓰기 방지)
      const { data: stepsForAnnotation } = await supabase
        .from('mm_steps')
        .select('id, step_number, ai_title, element_rect, click_x, click_y, user_annotations')
        .eq('tutorial_id', tutorial.id);

      if (stepsForAnnotation?.length) {
        await Promise.allSettled(
          stepsForAnnotation.map(async (step) => {
            // 이미 어노테이션이 있으면 건너뜀
            if (Array.isArray(step.user_annotations) && step.user_annotations.length > 0) return;

            const rect = step.element_rect as { x: number; y: number; width: number; height: number } | null;
            const label = step.ai_title ?? '클릭';
            const num = step.step_number ?? 1;
            let annotations;

            if (rect) {
              annotations = buildClickHighlight({ elementRect: rect, stepNumber: num, label });
            } else if (step.click_x != null && step.click_y != null && (step.click_x > 0 || step.click_y > 0)) {
              // click_x/y는 이미 0~1 정규화값으로 저장됨 (steps 삽입 시 /10000 처리)
              const estimatedRect = {
                x: Math.max(0, step.click_x - 0.05),
                y: Math.max(0, step.click_y - 0.02),
                width:  Math.min(0.10, 1 - Math.max(0, step.click_x - 0.05)),
                height: Math.min(0.04, 1 - Math.max(0, step.click_y - 0.02)),
              };
              annotations = buildClickHighlight({ elementRect: estimatedRect, stepNumber: num, label });
            } else {
              return; // 좌표 정보 없음 (navigate/autoNav 포함)
            }

            await supabase
              .from('mm_steps')
              .update({ user_annotations: annotations })
              .eq('id', step.id);
          })
        );
      }
    }
  } catch {
    // 초안/어노테이션 생성 실패는 무시 — 튜토리얼은 정상 생성됨
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

  return NextResponse.json({ tutorial_id: tutorial.id, step_count: steps.length });
}

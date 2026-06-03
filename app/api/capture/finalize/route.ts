import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { captureFinalizeSchema } from '@/lib/validators';
import { generateDraft, extractCoverColors, generateAnnotations } from '@/lib/claude';
import { resolveFavicon } from '@/lib/favicon';
import { toEditorAnnotation, AUTO_ANNOTATION_PROMPT } from '@/lib/annotations';

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
    Array.from(new Set(events.map(ev => ev.domain_hostname).filter(Boolean))).map(async hostname => {
      if (!hostname) return;
      const sample = events.find(ev => ev.domain_hostname === hostname);
      const resolved = await resolveFavicon(sample?.domain_favicon, hostname, sample?.url).catch(() => null);
      faviconCache.set(hostname, resolved);
    })
  );

  // 캡처 이벤트 → mm_steps 변환
  const steps = events.map((ev, idx) => ({
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
    click_x:         ev.click_x        ?? null,
    click_y:         ev.click_y        ?? null,
    element_rect:    ev.element_rect   ?? null,
  }));

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
              .update({ user_title: d.user_title, user_script: d.user_script })
              .eq('id', d.id)
              .eq('tutorial_id', tutorial.id)
          )
        );
      }

      // 자동 어노테이션 생성 — click_x/y가 있는 스텝에 하이라이트+화살표+클릭 마커 자동 적용
      // 스텝 좌표 데이터를 다시 조회 (click_x, click_y, element_rect 포함)
      const { data: stepsWithCoords } = await supabase
        .from('mm_steps')
        .select('id, ai_title, ai_description, page_url, click_x, click_y, element_rect')
        .eq('tutorial_id', tutorial.id)
        .not('click_x', 'is', null);

      if (stepsWithCoords?.length) {
        await Promise.allSettled(
          stepsWithCoords.map(async step => {
            const locationData = {
              clickX:      step.click_x / 10000,
              clickY:      step.click_y / 10000,
              elementRect: step.element_rect ?? null,
              actionType:  null,
              actionLabel: step.ai_title ?? null,
            };
            const stepContext = `제목: ${step.ai_title ?? ''}, 설명: ${step.ai_description ?? ''}, URL: ${step.page_url ?? ''}`;

            const rawAnnotations = await generateAnnotations(AUTO_ANNOTATION_PROMPT, stepContext, locationData);
            if (!rawAnnotations.length) return;

            const annotations = (rawAnnotations as Record<string, unknown>[]).map(toEditorAnnotation);

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

  return NextResponse.json({ tutorial_id: tutorial.id, step_count: steps.length });
}

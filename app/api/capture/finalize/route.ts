import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { captureFinalizeSchema } from '@/lib/validators';
import { generateDraft, extractCoverColors } from '@/lib/claude';
import { detectCropRect } from '@/lib/smart-crop';

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
  if (session.status === 'done') {
    return NextResponse.json({ error: 'Session already finalized' }, { status: 409 });
  }

  // 캡처 이벤트 조회
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
    domain_favicon:  ev.domain_favicon  ?? null,
    viewport_w:        (ev as { viewport_w?: number | null }).viewport_w ?? null,
    viewport_h:        (ev as { viewport_h?: number | null }).viewport_h ?? null,
    element_selector:  (ev as { element_selector?: string | null }).element_selector ?? null,
    element_xpath:     (ev as { element_xpath?: string | null }).element_xpath ?? null,
  }));

  const { data: insertedSteps, error: stepsError } = await supabase
    .from('mm_steps')
    .insert(steps)
    .select('id, screenshot_url, viewport_w, viewport_h');

  if (stepsError || !insertedSteps) {
    // 롤백: 생성한 튜토리얼 삭제
    await supabase.from('mm_tutorials').delete().eq('id', tutorial.id);
    return NextResponse.json({ error: 'Failed to create steps' }, { status: 500 });
  }

  // 스마트 크롭 감지 — 백그라운드 비동기 (응답 시간 영향 없음)
  runSmartCropInBackground(
    supabase,
    insertedSteps,
    events.map(ev => ({
      click_x: ev.click_x as number,
      click_y: ev.click_y as number,
    }))
  );

  // 세션 완료 처리 + daily_manual_count atomic 증가 (병렬)
  await Promise.all([
    supabase
      .from('mm_capture_sessions')
      .update({ status: 'done', ended_at: new Date().toISOString() })
      .eq('id', session_id),
    supabase.rpc('increment_daily_manual_count', { uid: userId }),
  ]);

  // AI 초안 생성 — tutorial 제목 + 스텝별 user_title/user_script + 커버 색상
  try {
    const { data: createdSteps } = await supabase
      .from('mm_steps')
      .select('id, step_number, ai_title, ai_description, page_url, screenshot_url')
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
    }
  } catch {
    // 초안 생성 실패는 무시 — 튜토리얼은 정상 생성됨
  }

  return NextResponse.json({ tutorial_id: tutorial.id, step_count: steps.length });
}

// click_x/y는 mm_capture_events에 *10000 정수로 저장됨 → 0~1로 환산
function normalizeClick(raw: number): number {
  // 10000 이상이면 정수 저장 방식, 아니면 이미 0~1
  return raw > 1 ? raw / 10000 : raw;
}

async function runSmartCropInBackground(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createServiceRoleClient>,
  insertedSteps: Array<{ id: string; screenshot_url: string }>,
  clickCoords: Array<{ click_x: number; click_y: number }>
) {
  for (let i = 0; i < insertedSteps.length; i++) {
    const step = insertedSteps[i];
    const coord = clickCoords[i];
    if (!step || !coord || !step.screenshot_url) continue;

    try {
      const imgRes = await fetch(step.screenshot_url);
      if (!imgRes.ok) continue;

      const ct = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const buf = await imgRes.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');

      const clickX = normalizeClick(coord.click_x);
      const clickY = normalizeClick(coord.click_y);

      const cropRect = await detectCropRect(b64, ct, clickX, clickY);

      await supabase
        .from('mm_steps')
        .update({ crop_rect: cropRect })
        .eq('id', step.id);
    } catch {
      // 개별 스텝 크롭 실패는 무시
    }
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { captureFinalizeSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // 토큰으로 user_id 조회
  const { data: tokenRow } = await supabase
    .from('mm_extension_tokens')
    .select('user_id')
    .eq('token', auth.token)
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const userId = tokenRow.user_id;

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

  // daily_manual_count 확인 (무료 플랜 한도)
  const { data: user } = await supabase
    .from('mm_users')
    .select('daily_manual_count, daily_limit')
    .eq('id', userId)
    .single();

  if (user && user.daily_manual_count >= user.daily_limit) {
    return NextResponse.json({ error: 'Daily limit reached' }, { status: 429 });
  }

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
    page_url: ev.url,
    ai_title: ev.ai_title ?? null,
    ai_description: ev.ai_description ?? null,
  }));

  const { error: stepsError } = await supabase
    .from('mm_steps')
    .insert(steps);

  if (stepsError) {
    // 롤백: 생성한 튜토리얼 삭제
    await supabase.from('mm_tutorials').delete().eq('id', tutorial.id);
    return NextResponse.json({ error: 'Failed to create steps' }, { status: 500 });
  }

  // 세션 완료 처리 + daily_manual_count 증가 (병렬)
  await Promise.all([
    supabase
      .from('mm_capture_sessions')
      .update({ status: 'done', ended_at: new Date().toISOString() })
      .eq('id', session_id),
    supabase
      .from('mm_users')
      .update({ daily_manual_count: (user?.daily_manual_count ?? 0) + 1 })
      .eq('id', userId),
  ]);

  return NextResponse.json({ tutorial_id: tutorial.id, step_count: steps.length });
}

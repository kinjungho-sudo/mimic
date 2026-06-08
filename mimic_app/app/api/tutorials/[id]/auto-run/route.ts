import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

const RISK_KEYWORDS = ['삭제', '제거', '결제', '주문', '구매', '탈퇴', '초기화', 'delete', 'remove', 'pay', 'checkout', 'purchase'];

function detectRisk(title: string) {
  return RISK_KEYWORDS.some(k => title.toLowerCase().includes(k));
}

// POST — 실행 세션 생성 + pre-flight 정보 반환
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id: tutorialId } = await params;
  const supabase = createServiceRoleClient();

  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, title')
    .eq('id', tutorialId)
    .eq('user_id', auth.userId)
    .single();

  if (!tutorial) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: steps } = await supabase
    .from('mm_steps')
    .select('id, step_number, user_title, ai_title, page_url, element_selector, click_x, click_y')
    .eq('tutorial_id', tutorialId)
    .order('step_number', { ascending: true });

  const total = steps?.length ?? 0;
  const runnable = steps?.filter(s => s.page_url && (s.element_selector || s.click_x)).length ?? 0;
  const riskySteps = (steps ?? [])
    .filter(s => detectRisk(s.user_title ?? s.ai_title ?? ''))
    .map(s => ({ step_number: s.step_number, title: s.user_title ?? s.ai_title }));

  const { data: session, error } = await supabase
    .from('mm_execution_sessions')
    .insert({ tutorial_id: tutorialId, user_id: auth.userId, status: 'pending', total_steps: total })
    .select('id')
    .single();

  if (error || !session) return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });

  return NextResponse.json({
    execution_session_id: session.id,
    pre_flight: { total, runnable, risky_steps: riskySteps },
  });
}

// GET — 실행 상태 조회
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id: tutorialId } = await params;
  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 });

  const supabase = createServiceRoleClient();

  const { data: session } = await supabase
    .from('mm_execution_sessions')
    .select('id, status, total_steps, completed_steps, started_at, finished_at')
    .eq('id', sessionId)
    .eq('tutorial_id', tutorialId)
    .eq('user_id', auth.userId)
    .single();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const { data: results } = await supabase
    .from('mm_step_results')
    .select('step_number, status, selector_used, error_message, executed_at')
    .eq('execution_session_id', sessionId)
    .order('step_number', { ascending: true });

  return NextResponse.json({ ...session, step_results: results ?? [] });
}

// PATCH — 세션 상태 업데이트 (pause/resume/stop)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id: tutorialId } = await params;
  const { session_id, status } = await request.json() as { session_id: string; status: string };
  if (!session_id || !status) return NextResponse.json({ error: 'session_id and status required' }, { status: 400 });

  const supabase = createServiceRoleClient();

  const patch: Record<string, unknown> = { status };
  if (['completed', 'failed'].includes(status)) patch.finished_at = new Date().toISOString();

  const { error } = await supabase
    .from('mm_execution_sessions')
    .update(patch)
    .eq('id', session_id)
    .eq('tutorial_id', tutorialId)
    .eq('user_id', auth.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: true });
}

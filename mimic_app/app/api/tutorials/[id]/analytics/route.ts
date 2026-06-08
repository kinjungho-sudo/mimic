import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // 소유권 확인
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, title')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();
  if (!tutorial) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 이벤트 집계
  const { data: events } = await supabase
    .from('mm_view_events')
    .select('event_type, step_number, viewer_session_id')
    .eq('tutorial_id', id);

  if (!events || events.length === 0) {
    return NextResponse.json({
      total_views: 0, completions: 0, completion_rate: 0,
      step_funnel: [], avg_exit_step: null,
    });
  }

  // 세션별 집계
  const sessions = new Map<string, { steps: Set<number>; completed: boolean; maxStep: number }>();
  for (const ev of events) {
    const sid = ev.viewer_session_id;
    if (!sessions.has(sid)) sessions.set(sid, { steps: new Set(), completed: false, maxStep: 0 });
    const s = sessions.get(sid)!;
    if (ev.event_type === 'complete') s.completed = true;
    if (ev.event_type === 'step' && ev.step_number != null) {
      s.steps.add(ev.step_number);
      s.maxStep = Math.max(s.maxStep, ev.step_number);
    }
    if (ev.event_type === 'enter') s.steps.add(0);
  }

  const totalViews = sessions.size;
  const allSessions = Array.from(sessions.values());
  const completions = allSessions.filter(s => s.completed).length;
  const completionRate = totalViews > 0 ? Math.round((completions / totalViews) * 100) : 0;

  // 스텝별 도달 수 (funnel)
  const stepCounts = new Map<number, number>();
  for (const s of allSessions) {
    Array.from(s.steps).forEach(step => {
      if (step > 0) stepCounts.set(step, (stepCounts.get(step) ?? 0) + 1);
    });
  }
  const stepFunnel = Array.from(stepCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([step, count]) => ({ step, count, pct: totalViews > 0 ? Math.round(count / totalViews * 100) : 0 }));

  // 평균 이탈 스텝
  const exitSteps = allSessions
    .filter(s => !s.completed && s.maxStep > 0)
    .map(s => s.maxStep);
  const avgExitStep = exitSteps.length > 0
    ? Math.round(exitSteps.reduce((a, b) => a + b, 0) / exitSteps.length * 10) / 10
    : null;

  return NextResponse.json({
    total_views: totalViews,
    completions,
    completion_rate: completionRate,
    step_funnel: stepFunnel,
    avg_exit_step: avgExitStep,
  });
}

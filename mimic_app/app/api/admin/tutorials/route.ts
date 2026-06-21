import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/auth-guard';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const service = createServiceRoleClient();
  const [tutorialsRes, viewsRes] = await Promise.all([
    service
      .from('mm_tutorials')
      .select('id, title, status, visibility, mode, created_at, user_id, mm_users(email, name)')
      .order('created_at', { ascending: false }),
    service
      .from('mm_view_events')
      .select('tutorial_id')
      .eq('event_type', 'enter')
      .limit(100000), // 메모리 안전 상한 — 초과 시 view_count 부정확(데이터 증가 시 SQL 집계 RPC로 전환)
  ]);

  if (tutorialsRes.error) return NextResponse.json({ error: tutorialsRes.error.message }, { status: 500 });
  if ((viewsRes.data?.length ?? 0) >= 100000) console.warn('[admin/tutorials] view_events 100k 상한 도달 — view_count 부정확, RPC 집계 전환 필요');

  const viewCounts: Record<string, number> = {};
  for (const v of viewsRes.data ?? []) {
    viewCounts[v.tutorial_id] = (viewCounts[v.tutorial_id] ?? 0) + 1;
  }

  const tutorials = (tutorialsRes.data ?? []).map(t => ({
    ...t,
    view_count: viewCounts[t.id] ?? 0,
  }));

  return NextResponse.json({ tutorials });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { tutorialId } = await request.json();
  if (!tutorialId) return NextResponse.json({ error: 'tutorialId required' }, { status: 400 });

  const service = createServiceRoleClient();
  const { error } = await service
    .from('mm_tutorials')
    .delete()
    .eq('id', tutorialId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

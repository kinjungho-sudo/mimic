import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkStepFreshness } from '@/lib/freshness';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // 소유권 확인
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();
  if (!tutorial) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // page_url이 있는 스텝만 체크
  const { data: steps } = await supabase
    .from('mm_steps')
    .select('id, page_url, screenshot_url, freshness_checked_at')
    .eq('tutorial_id', id)
    .not('page_url', 'is', null);

  if (!steps || steps.length === 0) {
    return NextResponse.json({ checked: 0, stale: 0 });
  }

  const results = await Promise.allSettled(
    steps.map(s => checkStepFreshness(s.id, s.page_url!, s.screenshot_url))
  );

  let staleCount = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.is_stale) staleCount++;
  }

  return NextResponse.json({ checked: steps.length, stale: staleCount });
}

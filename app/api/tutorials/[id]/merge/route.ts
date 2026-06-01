import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  source_tutorial_id: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;

  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { source_tutorial_id: sourceId } = parsed.data;

  const svc = createServiceRoleClient();

  // 대상 튜토리얼 소유권 확인
  const { data: target } = await svc
    .from('mm_tutorials')
    .select('id, user_id')
    .eq('id', targetId)
    .eq('user_id', userId)
    .single();
  if (!target) return NextResponse.json({ error: 'Tutorial not found' }, { status: 404 });

  // 소스 튜토리얼 소유권 + 스텝 조회
  const { data: sourceSteps } = await svc
    .from('mm_steps')
    .select('*')
    .eq('tutorial_id', sourceId)
    .order('step_number', { ascending: true });

  if (!sourceSteps || sourceSteps.length === 0) {
    return NextResponse.json({ error: 'Source has no steps' }, { status: 422 });
  }

  // 현재 대상 튜토리얼의 마지막 step_number 확인
  const { data: lastStep } = await svc
    .from('mm_steps')
    .select('step_number, order_index')
    .eq('tutorial_id', targetId)
    .order('step_number', { ascending: false })
    .limit(1)
    .single();

  const baseNumber = lastStep?.step_number ?? 0;
  const baseIndex = lastStep?.order_index ?? -1;

  // 소스 스텝들을 대상 튜토리얼에 복사
  const newSteps = sourceSteps.map((s, i) => ({
    tutorial_id: targetId,
    step_number: baseNumber + i + 1,
    order_index: baseIndex + i + 1,
    screenshot_url: s.screenshot_url,
    page_url: s.page_url,
    ai_title: s.ai_title,
    ai_description: s.ai_description,
    user_title: s.user_title,
    user_script: s.user_script,
    domain_hostname: s.domain_hostname,
    domain_name: s.domain_name,
    domain_favicon: s.domain_favicon,
    click_x: s.click_x,
    click_y: s.click_y,
  }));

  const { error } = await svc.from('mm_steps').insert(newSteps);
  if (error) return NextResponse.json({ error: 'Failed to merge steps' }, { status: 500 });

  // 소스 튜토리얼 삭제 (병합 완료 후 정리)
  await svc.from('mm_tutorials').delete().eq('id', sourceId);

  return NextResponse.json({ merged: newSteps.length });
}

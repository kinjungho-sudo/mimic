import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardStepAccess } from '@/lib/auth/workspace-guard';
import { logServer } from '@/lib/logging/logger-server';

type Params = { params: Promise<{ id: string }> };

// POST /api/steps/[id]/duplicate — 소스 스텝을 DB 행 전체 복사해 바로 다음 위치에 삽입
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const guard = await guardStepAccess(id, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();

  const { data: src } = await supabase
    .from('mm_steps')
    .select('*')
    .eq('id', id)
    .single();
  if (!src) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 소스 이후 스텝들의 order_index/step_number를 1씩 밀어 빈 자리 확보
  const { data: after } = await supabase
    .from('mm_steps')
    .select('id, order_index, step_number')
    .eq('tutorial_id', src.tutorial_id)
    .gt('order_index', src.order_index);
  if (after?.length) {
    const shifts = await Promise.all(after.map(s =>
      supabase
        .from('mm_steps')
        .update({ order_index: s.order_index + 1, step_number: s.step_number + 1 })
        .eq('id', s.id)
    ));
    if (shifts.some(r => r.error)) {
      await logServer('error', 'step.duplicate.shift.fail', { stepId: id, userId: auth.userId });
      return NextResponse.json({ error: 'Duplicate failed' }, { status: 500 });
    }
  }

  // 소스 콘텐츠 전체 복사 (불변 컬럼 제외) — 스크린샷·좌표·crop·어노테이션까지 그대로 유지
  const { id: _omitId, created_at: _c, updated_at: _u, ...rest } = src;
  void _omitId; void _c; void _u;
  const { data: created, error } = await supabase
    .from('mm_steps')
    .insert({ ...rest, order_index: src.order_index + 1, step_number: src.step_number + 1 })
    .select('id, step_number, order_index')
    .single();

  if (error || !created) {
    await logServer('error', 'step.duplicate.fail', { stepId: id, userId: auth.userId, message: error?.message });
    return NextResponse.json({ error: 'Duplicate failed' }, { status: 500 });
  }

  return NextResponse.json(created, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

const importSchema = z.object({
  source_tutorial_id: z.string().uuid(),
  step_ids: z.array(z.string().uuid()).min(1),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id: targetId } = await params;
  const supabase = createServiceRoleClient();

  const { data: targetTutorial } = await supabase
    .from('mm_tutorials')
    .select('id')
    .eq('id', targetId)
    .eq('user_id', auth.userId)
    .is('deleted_at', null)
    .single();

  if (!targetTutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { source_tutorial_id, step_ids } = parsed.data;

  // 소스 튜토리얼 읽기 권한 확인 (본인 소유 또는 워크스페이스 멤버)
  const { data: sourceTutorial } = await supabase
    .from('mm_tutorials')
    .select('id, user_id, workspace_id')
    .eq('id', source_tutorial_id)
    .is('deleted_at', null)
    .single();

  if (!sourceTutorial) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  if (sourceTutorial.user_id !== auth.userId) {
    if (sourceTutorial.workspace_id) {
      const { data: member } = await supabase
        .from('mm_workspace_members')
        .select('role')
        .eq('workspace_id', sourceTutorial.workspace_id)
        .eq('user_id', auth.userId)
        .single();
      if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // 소스 스텝 조회
  const { data: sourceSteps } = await supabase
    .from('mm_steps')
    .select('*')
    .eq('tutorial_id', source_tutorial_id)
    .in('id', step_ids)
    .order('order_index');

  if (!sourceSteps?.length) {
    return NextResponse.json({ error: 'Steps not found' }, { status: 404 });
  }

  // 현재 타겟의 마지막 order_index/step_number 조회
  const { data: lastStep } = await supabase
    .from('mm_steps')
    .select('order_index, step_number')
    .eq('tutorial_id', targetId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseOrderIndex = (lastStep?.order_index ?? -1) + 1;
  const baseStepNumber = (lastStep?.step_number ?? 0) + 1;

  // 클라이언트가 보낸 step_ids 순서(=사용자가 화면에서 선택한 순서)를 권위로 삼는다.
  // DB order_index로만 재정렬하면 표시 순서와 어긋날 수 있음.
  const byId = new Map(sourceSteps.map(s => [s.id, s]));
  const orderedSteps = step_ids.map(sid => byId.get(sid)).filter((s): s is NonNullable<typeof s> => !!s);

  const newSteps = orderedSteps.map((s, i) => ({
    tutorial_id: targetId,
    order_index: baseOrderIndex + i,
    step_number: baseStepNumber + i,
    user_title: s.user_title ?? s.ai_title ?? '불러온 단계',
    user_script: s.user_script ?? s.ai_description ?? null,
    screenshot_url: s.screenshot_url ?? null,
    page_url: s.page_url ?? null,
    domain_hostname: s.domain_hostname ?? null,
    domain_name: s.domain_name ?? null,
    domain_favicon: s.domain_favicon ?? null,
    click_x: s.click_x ?? null,
    click_y: s.click_y ?? null,
    element_rect: s.element_rect ?? null,
    user_annotations: s.user_annotations ?? null,
    crop_rect: s.crop_rect ?? null,
    image_zoom: s.image_zoom ?? null,
    image_offset_x: s.image_offset_x ?? null,
    image_offset_y: s.image_offset_y ?? null,
  }));

  const { data: created, error } = await supabase
    .from('mm_steps')
    .insert(newSteps)
    .select('id, step_number, order_index, user_title, user_script, screenshot_url, page_url, domain_hostname, domain_name, domain_favicon, ai_title, ai_description, click_x, click_y, element_rect, user_annotations, crop_rect, image_zoom, image_offset_x, image_offset_y');

  if (error || !created) {
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ steps: created }, { status: 201 });
}

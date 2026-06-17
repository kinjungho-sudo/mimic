import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardTutorialAccess } from '@/lib/workspace-guard';
import { z } from 'zod';

const stepCreateSchema = z.object({
  tutorial_id: z.string().uuid(),
  order_index: z.number().int().min(0),
  step_number: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = stepCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // 워크스페이스/공유 협업자도 editor 이상이면 단계 추가 허용 (다른 스텝 라우트와 일관)
  const access = await guardTutorialAccess(parsed.data.tutorial_id, auth.userId, 'editor');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('mm_steps')
    .insert({
      tutorial_id: parsed.data.tutorial_id,
      order_index: parsed.data.order_index,
      step_number: parsed.data.step_number,
      user_title: '새 단계',
    })
    .select('id, step_number, order_index, user_title, user_script, screenshot_url, page_url, domain_hostname, domain_name, domain_favicon, ai_title, ai_description')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

const reorderSchema = z.object({
  tutorial_id: z.string().uuid(),
  order: z.array(z.object({ id: z.string().uuid(), order_index: z.number().int().min(0) })).min(1),
});

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // 워크스페이스/공유 협업자도 editor 이상이면 재정렬 허용 (다른 스텝 라우트와 일관)
  const access = await guardTutorialAccess(parsed.data.tutorial_id, auth.userId, 'editor');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const supabase = createServiceRoleClient();

  const updates = await Promise.all(
    parsed.data.order.map(({ id, order_index }) =>
      supabase.from('mm_steps').update({ order_index }).eq('id', id).eq('tutorial_id', parsed.data.tutorial_id)
    )
  );

  if (updates.some(r => r.error)) {
    return NextResponse.json({ error: 'Some updates failed' }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

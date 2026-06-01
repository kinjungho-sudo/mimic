import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

const stepPatchSchema = z.object({
  user_title: z.string().max(200).nullable().optional(),
  user_script: z.string().max(2000).nullable().optional(),
  user_annotations: z.array(z.unknown()).nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = stepPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // user_id 소유 확인 — mm_tutorials 조인
  const { data: step, error: findError } = await supabase
    .from('mm_steps')
    .select('id, tutorial_id, mm_tutorials!inner(user_id)')
    .eq('id', id)
    .single();

  if (findError || !step) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const tutorial = (step as unknown as { mm_tutorials: { user_id: string } }).mm_tutorials;
  if (tutorial.user_id !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('mm_steps')
    .update(parsed.data)
    .eq('id', id)
    .select('id, user_title, user_script, user_annotations')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: step } = await supabase
    .from('mm_steps')
    .select('id, mm_tutorials!inner(user_id)')
    .eq('id', id)
    .single();

  if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const owner = (step as unknown as { mm_tutorials: { user_id: string } }).mm_tutorials;
  if (owner.user_id !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('mm_steps').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}

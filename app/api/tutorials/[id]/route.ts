import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { tutorialPatchSchema } from '@/lib/validators';
import { hashPassword } from '@/lib/password';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: tutorial, error } = await supabase
    .from('mm_tutorials')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();

  if (error || !tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: steps } = await supabase
    .from('mm_steps')
    .select('*')
    .eq('tutorial_id', id)
    .order('order_index');

  const stepIds = (steps ?? []).map(s => s.id);

  const [markersRes, audioRes, annotationsRes] = await Promise.all([
    supabase.from('mm_markers').select('*').in('step_id', stepIds),
    supabase.from('mm_audio_assets').select('*').in('step_id', stepIds),
    supabase.from('mm_annotations').select('*').in('step_id', stepIds),
  ]);

  return NextResponse.json({
    ...tutorial,
    steps: steps ?? [],
    markers: markersRes.data ?? [],
    audio_assets: audioRes.data ?? [],
    annotations: annotationsRes.data ?? [],
  });
}

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

  const parsed = tutorialPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  // share_password가 있으면 해싱 후 저장
  const updateData = { ...parsed.data };
  if (typeof updateData.share_password === 'string' && updateData.share_password.length > 0) {
    updateData.share_password = await hashPassword(updateData.share_password);
  }
  const { data, error } = await supabase
    .from('mm_tutorials')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found or update failed' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('mm_tutorials')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId);

  if (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { tutorialPatchSchema } from '@/lib/validators';

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
  const { data, error } = await supabase
    .from('mm_tutorials')
    .update(parsed.data)
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

  // 튜토리얼 조회 (소유자 확인 + 워크스페이스 확인)
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, user_id, workspace_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 팀 매뉴얼인 경우 admin 권한 필요
  if (tutorial.workspace_id) {
    const { data: membership } = await supabase
      .from('mm_workspace_members')
      .select('role')
      .eq('workspace_id', tutorial.workspace_id)
      .eq('user_id', auth.userId)
      .single();
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: '팀 매뉴얼은 관리자만 삭제할 수 있습니다.' }, { status: 403 });
    }
  } else if (tutorial.user_id !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Soft-delete
  const { error } = await supabase
    .from('mm_tutorials')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { tutorialPatchSchema } from '@/lib/validators';
import { hashPassword } from '@/lib/password';
import { guardTutorialAccess } from '@/lib/workspace-guard';

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
    .is('deleted_at', null)
    .single();

  if (error || !tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 접근 권한 확인 + my_role 계산
  let myRole: 'owner' | 'admin' | 'editor' | 'viewer' | null = null;

  if (tutorial.user_id === auth.userId) {
    myRole = 'owner';
  } else if (tutorial.workspace_id) {
    const { data: member } = await supabase
      .from('mm_workspace_members')
      .select('role')
      .eq('workspace_id', tutorial.workspace_id)
      .eq('user_id', auth.userId)
      .single();

    const { data: ws } = await supabase
      .from('mm_workspaces')
      .select('owner_id')
      .eq('id', tutorial.workspace_id)
      .single();

    if (ws?.owner_id === auth.userId) {
      myRole = 'owner';
    } else if (member) {
      myRole = member.role as 'admin' | 'editor' | 'viewer';
    }
  }

  if (!myRole) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    my_role: myRole,
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

  // 워크스페이스 역할 체크 (개인 튜토리얼이면 소유자, 워크스페이스면 editor 이상)
  const guard = await guardTutorialAccess(id, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
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

  // 워크스페이스 튜토리얼 삭제는 admin 이상만 허용
  const guard = await guardTutorialAccess(id, auth.userId, 'admin');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();

  // soft delete — 휴지통으로 이동 (30일 후 Cron이 영구 삭제)
  const { error } = await supabase
    .from('mm_tutorials')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

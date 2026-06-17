import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

// POST /api/trash/[id] — 복원 (deleted_at = null)
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, user_id, workspace_id')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .single();

  if (!tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 팀 매뉴얼 복원도 admin만
  if (tutorial.workspace_id) {
    const { data: membership } = await supabase
      .from('mm_workspace_members')
      .select('role')
      .eq('workspace_id', tutorial.workspace_id)
      .eq('user_id', auth.userId)
      .single();
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: '팀 매뉴얼은 관리자만 복원할 수 있습니다.' }, { status: 403 });
    }
  } else if (tutorial.user_id !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase
    .from('mm_tutorials')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/trash/[id] — 영구 삭제
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, user_id, workspace_id')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .single();

  if (!tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (tutorial.workspace_id) {
    const { data: membership } = await supabase
      .from('mm_workspace_members')
      .select('role')
      .eq('workspace_id', tutorial.workspace_id)
      .eq('user_id', auth.userId)
      .single();
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: '팀 매뉴얼은 관리자만 영구 삭제할 수 있습니다.' }, { status: 403 });
    }
  } else if (tutorial.user_id !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase
    .from('mm_tutorials')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Permanent delete failed' }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

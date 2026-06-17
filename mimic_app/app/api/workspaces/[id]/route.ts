import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

const patchSchema = z.object({ name: z.string().min(1).max(50) });

// GET /api/workspaces/[id] — 워크스페이스 상세 + 멤버 목록
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  // 접근 권한 확인
  const { data: member } = await supabase
    .from('mm_workspace_members')
    .select('role')
    .eq('workspace_id', id)
    .eq('user_id', auth.userId)
    .single();

  const { data: ws } = await supabase
    .from('mm_workspaces')
    .select()
    .eq('id', id)
    .single();

  if (!ws) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const isOwner = ws.owner_id === auth.userId;
  if (!member && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // 멤버 목록
  const { data: members } = await supabase
    .from('mm_workspace_members')
    .select('*, mm_users(name, email, avatar_url)')
    .eq('workspace_id', id)
    .order('joined_at', { ascending: true });

  // 대기 중인 초대 목록
  const { data: invitations } = await supabase
    .from('mm_workspace_invitations')
    .select()
    .eq('workspace_id', id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  const enrichedMembers = (members ?? []).map(m => ({
    id: m.id,
    workspace_id: m.workspace_id,
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    user: m.mm_users as { name: string; email: string; avatar_url: string | null } | null,
  }));

  return NextResponse.json({
    ...ws,
    my_role: isOwner ? 'admin' : member?.role,
    members: enrichedMembers,
    invitations: invitations ?? [],
  });
}

// PATCH /api/workspaces/[id] — 이름 수정 (admin만)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = createServiceRoleClient();

  const { data: ws } = await supabase.from('mm_workspaces').select('owner_id').eq('id', id).single();
  if (!ws) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: member } = await supabase.from('mm_workspace_members').select('role').eq('workspace_id', id).eq('user_id', auth.userId).single();
  if (ws.owner_id !== auth.userId && member?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: updated } = await supabase.from('mm_workspaces').update({ name: parsed.data.name }).eq('id', id).select().single();
  return NextResponse.json(updated);
}

// DELETE /api/workspaces/[id] — 삭제 (owner만)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: ws } = await supabase.from('mm_workspaces').select('owner_id').eq('id', id).single();
  if (!ws) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (ws.owner_id !== auth.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await supabase.from('mm_workspaces').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

const patchSchema = z.object({ role: z.enum(['admin', 'editor', 'viewer']) });

async function getMyRole(supabase: ReturnType<typeof createServiceRoleClient>, workspaceId: string, userId: string) {
  const { data: ws } = await supabase.from('mm_workspaces').select('owner_id').eq('id', workspaceId).single();
  if (ws?.owner_id === userId) return 'admin' as const;
  const { data: m } = await supabase.from('mm_workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', userId).single();
  return m?.role as 'admin' | 'editor' | 'viewer' | null;
}

// PATCH /api/workspaces/[id]/members/[memberId] — 권한 변경
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id, memberId } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = createServiceRoleClient();
  const myRole = await getMyRole(supabase, id, auth.userId);
  if (myRole !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: target } = await supabase.from('mm_workspace_members').select('user_id').eq('id', memberId).eq('workspace_id', id).single();
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // owner는 권한 변경 불가
  const { data: ws } = await supabase.from('mm_workspaces').select('owner_id').eq('id', id).single();
  if (target.user_id === ws?.owner_id) return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });

  const { data: updated } = await supabase.from('mm_workspace_members').update({ role: parsed.data.role }).eq('id', memberId).select().single();
  return NextResponse.json(updated);
}

// DELETE /api/workspaces/[id]/members/[memberId] — 멤버 제거
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id, memberId } = await params;
  const supabase = createServiceRoleClient();

  const { data: target } = await supabase.from('mm_workspace_members').select('user_id').eq('id', memberId).eq('workspace_id', id).single();
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // 본인 탈퇴 또는 admin이 제거
  const myRole = await getMyRole(supabase, id, auth.userId);
  if (target.user_id !== auth.userId && myRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // owner는 제거 불가
  const { data: ws } = await supabase.from('mm_workspaces').select('owner_id').eq('id', id).single();
  if (target.user_id === ws?.owner_id) return NextResponse.json({ error: 'Cannot remove owner' }, { status: 400 });

  await supabase.from('mm_workspace_members').delete().eq('id', memberId);
  return NextResponse.json({ ok: true });
}

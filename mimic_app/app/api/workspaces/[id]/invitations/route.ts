import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendWorkspaceInvitation } from '@/lib/email';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
});

// POST /api/workspaces/[id]/invitations — 초대 발송
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id: workspaceId } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = createServiceRoleClient();

  // admin 권한 확인
  const { data: ws } = await supabase.from('mm_workspaces').select('name, owner_id').eq('id', workspaceId).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data: myMember } = await supabase.from('mm_workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', auth.userId).single();
  const isOwner = ws.owner_id === auth.userId;
  if (!isOwner && myMember?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 이미 멤버인지 확인
  const { data: existingUser } = await supabase.from('mm_users').select('id').eq('email', parsed.data.email).single();
  if (existingUser) {
    const { data: existingMember } = await supabase.from('mm_workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', existingUser.id).single();
    if (existingMember) return NextResponse.json({ error: '이미 워크스페이스 멤버입니다.' }, { status: 409 });
  }

  // 기존 pending 초대 만료 처리
  await supabase
    .from('mm_workspace_invitations')
    .update({ status: 'expired' })
    .eq('workspace_id', workspaceId)
    .eq('email', parsed.data.email)
    .eq('status', 'pending');

  // 새 초대 생성
  const { data: invitation, error } = await supabase
    .from('mm_workspace_invitations')
    .insert({
      workspace_id: workspaceId,
      inviter_id: auth.userId,
      email: parsed.data.email,
      role: parsed.data.role,
    })
    .select()
    .single();

  if (error || !invitation) return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });

  // 초대자 이름 조회
  const { data: inviter } = await supabase.from('mm_users').select('name').eq('id', auth.userId).single();

  // 이메일 발송
  try {
    await sendWorkspaceInvitation({
      to: parsed.data.email,
      inviterName: inviter?.name ?? '팀원',
      workspaceName: ws.name,
      role: parsed.data.role,
      token: invitation.token,
    });
  } catch (emailErr) {
    console.error('Email send failed:', emailErr);
    // 이메일 실패해도 초대장은 생성됨 — 링크 공유로 대체 가능
  }

  return NextResponse.json(invitation, { status: 201 });
}

// DELETE /api/workspaces/[id]/invitations?token=xxx — 초대 취소
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id: workspaceId } = await params;
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const supabase = createServiceRoleClient();

  const { data: ws } = await supabase.from('mm_workspaces').select('owner_id').eq('id', workspaceId).single();
  const { data: myMember } = await supabase.from('mm_workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', auth.userId).single();
  if (ws?.owner_id !== auth.userId && myMember?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabase.from('mm_workspace_invitations').update({ status: 'expired' }).eq('token', token).eq('workspace_id', workspaceId);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

// GET /api/workspace-invite/[token] — 초대 정보 조회 (미인증도 가능)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: inv } = await supabase
    .from('mm_workspace_invitations')
    .select('*, mm_workspaces(name), mm_users!inviter_id(name)')
    .eq('token', token)
    .single();

  if (!inv) return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
  if (inv.status !== 'pending') return NextResponse.json({ error: 'Invitation already used or expired', status: inv.status }, { status: 410 });
  if (new Date(inv.expires_at) < new Date()) {
    await supabase.from('mm_workspace_invitations').update({ status: 'expired' }).eq('token', token);
    return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
  }

  return NextResponse.json({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    expires_at: inv.expires_at,
    workspace: inv.mm_workspaces,
    inviter: inv.mm_users,
  });
}

// POST /api/workspace-invite/[token] — 초대 수락
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: inv } = await supabase
    .from('mm_workspace_invitations')
    .select()
    .eq('token', token)
    .single();

  if (!inv) return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
  if (inv.status !== 'pending') return NextResponse.json({ error: 'Invitation already used or expired' }, { status: 410 });
  if (new Date(inv.expires_at) < new Date()) {
    await supabase.from('mm_workspace_invitations').update({ status: 'expired' }).eq('token', token);
    return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
  }

  // 현재 로그인 유저의 이메일이 초대 이메일과 일치하는지 확인
  const { data: me } = await supabase.from('mm_users').select('email').eq('id', auth.userId).single();
  if (!me || me.email.toLowerCase() !== inv.email.toLowerCase()) {
    return NextResponse.json({ error: '초대받은 이메일로 로그인해야 합니다.' }, { status: 403 });
  }

  // 이미 멤버인지 확인
  const { data: existing } = await supabase.from('mm_workspace_members').select('id').eq('workspace_id', inv.workspace_id).eq('user_id', auth.userId).single();
  if (existing) {
    await supabase.from('mm_workspace_invitations').update({ status: 'accepted' }).eq('token', token);
    return NextResponse.json({ workspace_id: inv.workspace_id, already_member: true });
  }

  // 멤버 추가 + 초대 상태 업데이트 (병렬)
  await Promise.all([
    supabase.from('mm_workspace_members').insert({
      workspace_id: inv.workspace_id,
      user_id: auth.userId,
      role: inv.role,
    }),
    supabase.from('mm_workspace_invitations').update({ status: 'accepted' }).eq('token', token),
  ]);

  return NextResponse.json({ workspace_id: inv.workspace_id });
}

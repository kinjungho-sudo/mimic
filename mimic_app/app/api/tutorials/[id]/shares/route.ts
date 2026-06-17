import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { logActivity } from '@/lib/activity';
import { sendManualShareInvitation } from '@/lib/email/email';

type Params = { params: Promise<{ id: string }> };

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/^﻿/, '').trim();

// 공유 관리 권한: 매뉴얼 소유자 또는 워크스페이스 owner/admin 만
async function requireManager(tutorialId: string, userId: string) {
  const guard = await guardTutorialAccess(tutorialId, userId, 'editor');
  if (!guard.ok) return { ok: false as const, status: guard.status, error: guard.error };
  if (guard.role !== 'owner' && guard.role !== 'admin') {
    return { ok: false as const, status: 403, error: '공유는 소유자 또는 관리자만 관리할 수 있습니다.' };
  }
  return { ok: true as const };
}

// GET — 현재 공유 목록
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const mgr = await requireManager(id, auth.userId);
  if (!mgr.ok) return NextResponse.json({ error: mgr.error }, { status: mgr.status });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('mm_manual_shares')
    .select('id, email, role, user_id, created_at, user:mm_users!mm_manual_shares_user_id_fkey(name, avatar_url)')
    .eq('tutorial_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shares: data ?? [] });
}

// POST — 이메일 초대 (email, role)
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { email, role } = (body ?? {}) as { email?: string; role?: string };

  const emailNorm = (email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return NextResponse.json({ error: '올바른 이메일을 입력하세요.' }, { status: 400 });
  }
  const roleNorm: 'viewer' | 'editor' = role === 'editor' ? 'editor' : 'viewer';

  const mgr = await requireManager(id, auth.userId);
  if (!mgr.ok) return NextResponse.json({ error: mgr.error }, { status: mgr.status });

  const supabase = createServiceRoleClient();

  // 소유자 자신은 초대 불가
  const { data: tutorial } = await supabase.from('mm_tutorials').select('title, user_id').eq('id', id).single();
  const { data: me } = await supabase.from('mm_users').select('email, name').eq('id', auth.userId).single();
  if (me?.email && me.email.toLowerCase() === emailNorm) {
    return NextResponse.json({ error: '본인은 초대할 수 없습니다.' }, { status: 400 });
  }

  // 이미 가입된 사용자면 user_id 연결
  const { data: invitedUser } = await supabase.from('mm_users').select('id').eq('email', emailNorm).maybeSingle();

  // upsert: (tutorial_id, email) 유니크 — 기존 공유면 역할 갱신
  const { data: share, error } = await supabase
    .from('mm_manual_shares')
    .upsert({
      tutorial_id: id,
      email: emailNorm,
      user_id: invitedUser?.id ?? null,
      role: roleNorm,
      invited_by: auth.userId,
    }, { onConflict: 'tutorial_id,email' })
    .select('id, email, role, user_id, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    tutorialId: id,
    actorId: auth.userId,
    action: 'share_invited',
    meta: { email: emailNorm, role: roleNorm },
  });

  // 초대 메일 (실패해도 공유 레코드는 유효 — best effort)
  try {
    const path = roleNorm === 'editor' ? `/manual/${id}/editor` : `/manual/${id}`;
    await sendManualShareInvitation({
      to: emailNorm,
      inviterName: me?.name ?? '동료',
      manualTitle: tutorial?.title ?? '매뉴얼',
      role: roleNorm,
      url: `${APP_URL}${path}`,
    });
  } catch (e) {
    console.error('manual share email failed:', e);
  }

  return NextResponse.json({ share }, { status: 201 });
}

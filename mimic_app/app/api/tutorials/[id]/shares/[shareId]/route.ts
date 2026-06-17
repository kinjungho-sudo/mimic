import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { logActivity } from '@/lib/activity';

type Params = { params: Promise<{ id: string; shareId: string }> };

async function requireManager(tutorialId: string, userId: string) {
  const guard = await guardTutorialAccess(tutorialId, userId, 'editor');
  if (!guard.ok) return { ok: false as const, status: guard.status, error: guard.error };
  if (guard.role !== 'owner' && guard.role !== 'admin') {
    return { ok: false as const, status: 403, error: '공유는 소유자 또는 관리자만 관리할 수 있습니다.' };
  }
  return { ok: true as const };
}

// PATCH — 권한 변경 (role)
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id, shareId } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const role: 'viewer' | 'editor' = (body as { role?: string })?.role === 'editor' ? 'editor' : 'viewer';

  const mgr = await requireManager(id, auth.userId);
  if (!mgr.ok) return NextResponse.json({ error: mgr.error }, { status: mgr.status });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('mm_manual_shares')
    .update({ role })
    .eq('id', shareId)
    .eq('tutorial_id', id)
    .select('id, email, role, user_id, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ share: data });
}

// DELETE — 공유 해제
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id, shareId } = await params;
  const mgr = await requireManager(id, auth.userId);
  if (!mgr.ok) return NextResponse.json({ error: mgr.error }, { status: mgr.status });

  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase
    .from('mm_manual_shares')
    .select('email')
    .eq('id', shareId)
    .eq('tutorial_id', id)
    .single();

  const { error } = await supabase
    .from('mm_manual_shares')
    .delete()
    .eq('id', shareId)
    .eq('tutorial_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    tutorialId: id,
    actorId: auth.userId,
    action: 'share_revoked',
    meta: { email: existing?.email ?? null },
  });

  return new NextResponse(null, { status: 204 });
}

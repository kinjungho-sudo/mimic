import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/logging/logger-server';

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null) as { tutorialId?: unknown } | null;
  const tutorialId = typeof body?.tutorialId === 'string' ? body.tutorialId.trim() : '';
  if (!tutorialId) {
    return NextResponse.json({ error: 'tutorialId required' }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const [{ data: tutorial }, { data: userData, error: userError }] = await Promise.all([
    service
      .from('mm_tutorials')
      .select('id')
      .eq('id', tutorialId)
      .eq('user_id', auth.userId)
      .maybeSingle(),
    service.auth.admin.getUserById(auth.userId),
  ]);

  const email = userData?.user?.email;
  if (!tutorial) {
    logAudit('desktop.handoff.fail', { userId: auth.userId, tutorialId, reason: 'manual_not_owned' }, 'warn');
    return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
  }
  if (userError || !email) {
    logAudit('desktop.handoff.fail', { userId: auth.userId, tutorialId, reason: 'account_email_missing' }, 'warn');
    return NextResponse.json({ error: 'Account email unavailable' }, { status: 409 });
  }

  const next = `/manual/${encodeURIComponent(tutorialId)}/editor`;
  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    logAudit('desktop.handoff.fail', { userId: auth.userId, tutorialId, reason: error?.message ?? 'link_generation_failed' }, 'warn');
    return NextResponse.json({ error: 'Failed to create browser handoff' }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const handoffUrl = new URL('/api/auth/extension-handoff', origin);
  handoffUrl.searchParams.set('token_hash', tokenHash);
  handoffUrl.searchParams.set('next', next);
  logAudit('desktop.handoff.created', { userId: auth.userId, tutorialId });
  return NextResponse.json({ editorUrl: handoffUrl.toString() });
}

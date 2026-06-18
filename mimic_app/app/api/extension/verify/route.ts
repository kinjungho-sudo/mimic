import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logNetwork } from '@/lib/logging/logger-server';

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  const { data: tokenRow, error } = await supabase
    .from('mm_extension_tokens')
    .select('id, user_id, used_at, expires_at')
    .eq('token', auth.token)
    .single();

  if (error || !tokenRow) {
    logNetwork('extension.verify.fail', { reason: 'invalid_token' }, 'warn');
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (tokenRow.used_at) {
    logNetwork('extension.verify.fail', { userId: tokenRow.user_id, reason: 'already_used' }, 'warn');
    return NextResponse.json({ error: 'Token already used' }, { status: 401 });
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    logNetwork('extension.verify.fail', { userId: tokenRow.user_id, reason: 'expired' }, 'warn');
    return NextResponse.json({ error: 'Token expired' }, { status: 401 });
  }

  await supabase
    .from('mm_extension_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id);

  logNetwork('extension.verify.success', { userId: tokenRow.user_id });
  return NextResponse.json({ user_id: tokenRow.user_id });
}

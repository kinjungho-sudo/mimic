import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/logging/logger-server';

function safeEditorPath(value: string | null): string | null {
  if (!value || !value.startsWith('/manual/') || !value.endsWith('/editor')) return null;
  if (value.startsWith('//') || value.includes('\\') || value.includes('?') || value.includes('#')) return null;
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const next = safeEditorPath(url.searchParams.get('next'));
  if (!tokenHash || !next) {
    return NextResponse.redirect(new URL('/auth/login?error=desktop_handoff_invalid', url.origin));
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (error || !data.user) {
    logAudit('desktop.handoff.fail', { reason: error?.message ?? 'session_exchange_failed' }, 'warn');
    const loginUrl = new URL('/auth/login', url.origin);
    loginUrl.searchParams.set('error', 'desktop_handoff_expired');
    loginUrl.searchParams.set('next', next);
    return NextResponse.redirect(loginUrl);
  }

  logAudit('desktop.handoff.success', { userId: data.user.id, next });
  return NextResponse.redirect(new URL(next, url.origin));
}

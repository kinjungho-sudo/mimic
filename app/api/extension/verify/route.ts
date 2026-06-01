import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

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
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (tokenRow.used_at) {
    return NextResponse.json({ error: 'Token already used' }, { status: 401 });
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 401 });
  }

  // used_at IS NULL 조건을 걸어 atomic하게 소각 — 동시 요청 시 하나만 성공
  const { data: updated } = await supabase
    .from('mm_extension_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)
    .is('used_at', null)
    .select('id');

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Token already used' }, { status: 401 });
  }

  return NextResponse.json({ user_id: tokenRow.user_id });
}

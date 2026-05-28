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

  await supabase
    .from('mm_extension_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id);

  const { data: user } = await supabase
    .from('mm_users')
    .select('id, email')
    .eq('id', tokenRow.user_id)
    .single();

  return NextResponse.json({ user_id: tokenRow.user_id, email: user?.email ?? '' });
}

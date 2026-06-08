import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 (일회성 링크 토큰)

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('mm_extension_tokens').insert({
    user_id: auth.userId,
    token,
    kind: 'link',
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }

  return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
}

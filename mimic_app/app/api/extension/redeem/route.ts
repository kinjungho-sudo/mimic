import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

// 링크 토큰(5분 일회성)을 세션 토큰(30일)으로 교환
// recorder의 LINK_USER 핸들러에서 호출
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const linkToken = (body as Record<string, unknown>)?.link_token;
  if (!linkToken || typeof linkToken !== 'string') {
    return NextResponse.json({ error: 'link_token required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // 링크 토큰 조회 — kind='link' + 미사용 + 미만료 여부 확인
  const { data: tokenRow } = await supabase
    .from('mm_extension_tokens')
    .select('id, user_id, used_at, expires_at, kind')
    .eq('token', linkToken)
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  if (tokenRow.kind !== 'link') {
    // 세션 토큰으로 재발급 시도 차단
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  if (tokenRow.used_at) {
    return NextResponse.json({ error: 'Token already used' }, { status: 401 });
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 401 });
  }

  // 링크 토큰 즉시 소각 — expires_at을 now()로 당겨 5분 내 재사용도 차단
  await supabase
    .from('mm_extension_tokens')
    .update({ used_at: new Date().toISOString(), expires_at: new Date().toISOString() })
    .eq('id', tokenRow.id);

  // 30일 세션 토큰 발급
  const sessionToken = randomBytes(32).toString('hex');
  const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from('mm_extension_tokens').insert({
    user_id: tokenRow.user_id,
    token: sessionToken,
    kind: 'session',
    expires_at: sessionExpiresAt.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to issue session token' }, { status: 500 });
  }

  return NextResponse.json({ session_token: sessionToken, expires_at: sessionExpiresAt.toISOString() });
}

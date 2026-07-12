import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '../supabase/server';

type AuthGuardResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

async function getVerifiedClaims() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error) return null;
  return data?.claims ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function requireAuth(_request: NextRequest): Promise<AuthGuardResult> {
  const claims = await getVerifiedClaims();
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { ok: true, userId };
}

// Admin 인증 — ADMIN_EMAIL 환경변수 기반
export async function requireAdmin(): Promise<AuthGuardResult> {
  const adminEmail = process.env.ADMIN_EMAIL?.replace(/^﻿/, '').trim();
  if (!adminEmail) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const claims = await getVerifiedClaims();
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;
  const email = typeof claims?.email === 'string' ? claims.email : null;

  if (!userId || email !== adminEmail) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId };
}

// Extension token 인증 — 포리 Recorder가 Bearer 토큰으로 호출
export async function requireExtensionToken(
  request: NextRequest
): Promise<{ ok: true; token: string; userId: string } | { ok: false; response: NextResponse }> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Missing bearer token' }, { status: 401 }),
    };
  }

  const token = auth.slice(7).trim();
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }),
    };
  }

  // 토큰 유효성 검증 (만료 + 소각 여부)
  const supabase = createServiceRoleClient();
  const { data: tokenRow } = await supabase
    .from('mm_extension_tokens')
    .select('user_id, used_at, expires_at, kind')
    .eq('token', token)
    .single();

  if (!tokenRow) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }
  // 링크 토큰(kind='link')은 API 호출에 사용 불가 — redeem 전용
  if (tokenRow.kind !== 'session') {
    return { ok: false, response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return { ok: false, response: NextResponse.json({ error: 'Token expired', code: 'TOKEN_EXPIRED' }, { status: 401 }) };
  }
  if (tokenRow.used_at) {
    return { ok: false, response: NextResponse.json({ error: 'Token already used', code: 'TOKEN_USED' }, { status: 401 }) };
  }

  return { ok: true, token, userId: tokenRow.user_id };
}

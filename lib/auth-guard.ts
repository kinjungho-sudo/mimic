import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from './supabase/server';

type AuthGuardResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function requireAuth(_request: NextRequest): Promise<AuthGuardResult> {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { ok: true, userId: session.user.id };
}

// Admin 인증 — ADMIN_EMAIL 환경변수 기반
export async function requireAdmin(): Promise<AuthGuardResult> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user || session.user.email !== adminEmail) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId: session.user.id };
}

// Extension token 인증 — MIMIC Recorder가 Bearer 토큰으로 호출
export async function requireExtensionToken(
  request: NextRequest
): Promise<{ ok: true; token: string } | { ok: false; response: NextResponse }> {
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

  return { ok: true, token };
}

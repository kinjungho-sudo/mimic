import { createClient } from '../supabase/client';
import { logAuditClient } from '@/lib/logging/logger';
import type { User, Agreements } from '@/types';

function translateAuthError(msg: string | undefined): string {
  if (!msg) return '오류가 발생했습니다.';
  if (msg.includes('User already registered') || msg.includes('already been registered')) return '이미 가입된 이메일입니다.';
  if (msg.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (msg.includes('Email not confirmed')) return '이메일 인증이 필요합니다. 받은편지함을 확인해주세요.';
  if (msg.includes('Password should be at least')) return '비밀번호는 8자 이상이어야 합니다.';
  if (msg.includes('Unable to validate email address')) return '올바른 이메일 형식이 아닙니다.';
  if (msg.includes('Too many requests') || msg.includes('rate limit')) return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  if (msg.includes('network') || msg.includes('fetch')) return '네트워크 오류가 발생했습니다. 연결을 확인해주세요.';
  return msg;
}

export async function signInWithGoogle(next?: string): Promise<void> {
  const supabase = createClient();
  const callbackUrl = new URL(`${window.location.origin}/api/auth/callback`);
  if (next) callbackUrl.searchParams.set('next', next);
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; session: unknown }> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    logAuditClient('auth.login.fail', { email, method: 'password', reason: error.message }, 'warn');
    throw new Error(translateAuthError(error.message));
  }
  logAuditClient('auth.login.success', { userId: data.user?.id ?? null, email, method: 'password' });

  const profile = await getCurrentUser();
  return { user: profile, session: data.session };
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
  agreements: Omit<Agreements, 'agreed_at'>
): Promise<void> {
  const res = await fetch('/api/auth/signup-with-agreements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, agreements }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(translateAuthError(err.error) ?? '회원가입에 실패했습니다.');
  }
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function resetPassword(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/api/auth/callback?type=recovery`,
  });
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();

  try {
    // getSession은 로컬 스토리지/쿠키에서 읽어 네트워크 없이 즉시 반환
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return null;

    const profileRes = await Promise.race([
      Promise.resolve(supabase.from('mm_users').select('*').eq('id', userId).single()),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    const profile = profileRes.data as User | null;
    if (!profile) return null;

    // auth_provider가 DB에 없는 기존 유저: 세션 메타데이터에서 보완
    if (!profile.auth_provider) {
      const provider = session?.user?.app_metadata?.provider;
      profile.auth_provider = provider === 'google' ? 'google' : 'email';
    }

    return profile;
  } catch {
    return null;
  }
}

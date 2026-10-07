import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// 인메모리 rate limiter — 같은 인스턴스 안의 폭주만 막는다.
// 인스턴스 간 공유가 필요한 경로(비밀번호 확인, AI 비용, 공개 폼)는 rateLimitShared를 쓴다.
const store = new Map<string, { count: number; reset: number }>();

function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSeconds)) } },
  );
}

export function rateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return null;
  }

  if (entry.count >= limit) {
    return tooManyRequests(Math.ceil((entry.reset - now) / 1000));
  }

  entry.count++;
  return null;
}

// DB(consume_rate_limit) 기반 공유 제한. DB 호출이 실패하면 인메모리 제한으로 대체해
// 마이그레이션 적용 전이나 장애 중에도 최소한의 방어는 유지한다.
export async function rateLimitShared(key: string, limit: number, windowMs: number): Promise<NextResponse | null> {
  try {
    const { data, error } = await createServiceRoleClient().rpc('consume_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw error ?? new Error('empty rate limit result');
    return row.allowed ? null : tooManyRequests(row.retry_after_seconds);
  } catch {
    return rateLimit(key, limit, windowMs);
  }
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

// AI API는 외부 모델 비용이 걸리므로 인스턴스 간 공유 제한을 쓴다.
export function rateLimitAi(userId: string): Promise<NextResponse | null> {
  return rateLimitShared(`ai:${userId}`, 20, 60_000);
}

// 일반 API — 1분당 60회
export function rateLimitApi(userId: string): NextResponse | null {
  return rateLimit(`api:${userId}`, 60, 60_000);
}

// 익명 공개 폼(문의·설문·사전신청·조회 이벤트) — IP 기준
export function rateLimitPublic(request: NextRequest, scope: string, limit: number, windowMs: number): Promise<NextResponse | null> {
  return rateLimitShared(`public:${scope}:${clientIp(request)}`, limit, windowMs);
}

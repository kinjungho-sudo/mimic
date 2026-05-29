import { NextResponse } from 'next/server';

// 인메모리 rate limiter — Vercel 단일 인스턴스용
// 프로덕션 트래픽이 커지면 Redis(Upstash) 기반으로 교체
const store = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return null;
  }

  if (entry.count >= limit) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((entry.reset - now) / 1000)),
        },
      }
    );
  }

  entry.count++;
  return null;
}

// TODO: 정식 서비스 전 한도 복구
// AI API 전용 — 테스트 기간 무제한
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function rateLimitAi(_userId: string): NextResponse | null {
  return null;
}

// 일반 API — 1분당 60회
export function rateLimitApi(userId: string): NextResponse | null {
  return rateLimit(`api:${userId}`, 60, 60_000);
}

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

// 클라이언트 로그 수집 엔드포인트.
// 인증 불필요(로그아웃 상태 오류도 수집). error/warn만 mm_logs에 저장.
const schema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  category: z.enum(['error', 'network', 'audit', 'system']).optional().default('error'),
  event: z.string().min(1).max(80),
  message: z.string().max(1000).nullable().optional(),
  context: z.record(z.string(), z.unknown()).nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  tutorialId: z.string().uuid().nullable().optional(),
  url: z.string().max(500).nullable().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const d = parsed.data;
  // error 카테고리는 error/warn만 저장(기존 규칙). network/audit/system은 레벨과 무관하게 저장.
  const shouldPersist = d.category === 'error' ? (d.level === 'error' || d.level === 'warn') : true;
  if (!shouldPersist) return NextResponse.json({ ok: true });

  try {
    const supabase = createServiceRoleClient();
    await supabase.from('mm_logs').insert({
      level: d.level,
      category: d.category,
      source: 'client',
      event: d.event,
      message: d.message ?? null,
      context: d.context ?? null,
      user_id: d.userId ?? null,
      tutorial_id: d.tutorialId ?? null,
      url: d.url ?? null,
    });
  } catch {
    /* 로깅 실패는 무시 — 절대 클라이언트에 에러 반환하지 않음 */
  }
  return NextResponse.json({ ok: true });
}

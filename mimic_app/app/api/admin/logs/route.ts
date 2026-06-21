import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/auth-guard';

// 어드민 로그/모니터링 조회.
//   ?category=all|error|network|audit|system  ?level=all|error|warn|info|debug
//   ?q=검색어(event/message)  ?before=ISO커서(이전 페이지)  ?limit=100
// 응답: { rows, nextCursor, summary } — summary는 최근 24시간 카테고리별/에러 건수.
const CATEGORIES = ['error', 'network', 'audit', 'system'] as const;
const LEVELS = ['error', 'warn', 'info', 'debug'] as const;
const PAGE = 100;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const category = sp.get('category') ?? 'all';
  const level = sp.get('level') ?? 'all';
  const q = (sp.get('q') ?? '').trim();
  const before = sp.get('before');
  const limit = Math.min(Number(sp.get('limit')) || PAGE, 200);

  const service = createServiceRoleClient();

  let query = service
    .from('mm_logs')
    .select('id, created_at, level, category, source, event, message, context, user_id, tutorial_id, url')
    .order('created_at', { ascending: false })
    .limit(limit + 1); // 다음 페이지 존재 여부 판단용 +1

  if (category !== 'all' && (CATEGORIES as readonly string[]).includes(category)) {
    query = query.eq('category', category);
  }
  if (level !== 'all' && (LEVELS as readonly string[]).includes(level)) {
    query = query.eq('level', level);
  }
  if (q) {
    // event 또는 message 부분일치 (대소문자 무시)
    // PostgREST or() 문법·ilike 와일드카드 메타문자 제거 (필터 주입 방지)
    const safe = q.replace(/[%_,()*\\"]/g, ' ').trim();
    if (safe) query = query.or(`event.ilike.%${safe}%,message.ilike.%${safe}%`);
  }
  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].created_at : null;

  // 최근 24시간 요약 — 카테고리별 건수 + 에러/경고 건수.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await service
    .from('mm_logs')
    .select('category, level')
    .gte('created_at', since)
    .limit(5000);

  const summary = { error: 0, network: 0, audit: 0, system: 0, errorLevel: 0, warnLevel: 0, total: 0 };
  for (const r of recent ?? []) {
    summary.total++;
    if (r.category in summary) (summary as Record<string, number>)[r.category]++;
    if (r.level === 'error') summary.errorLevel++;
    else if (r.level === 'warn') summary.warnLevel++;
  }

  return NextResponse.json({ rows: page, nextCursor, summary });
}

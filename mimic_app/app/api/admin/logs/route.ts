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

  const userIds = Array.from(new Set(page.map(row => row.user_id).filter((id): id is string => Boolean(id))));
  const tutorialIds = Array.from(new Set(page.map(row => row.tutorial_id).filter((id): id is string => Boolean(id))));
  const [usersRes, tutorialsRes] = await Promise.all([
    userIds.length ? service.from('mm_users').select('id, email').in('id', userIds) : Promise.resolve({ data: [] }),
    tutorialIds.length ? service.from('mm_tutorials').select('id, title').in('id', tutorialIds) : Promise.resolve({ data: [] }),
  ]);
  const userEmails = new Map((usersRes.data ?? []).map(user => [user.id, user.email]));
  const tutorialTitles = new Map((tutorialsRes.data ?? []).map(tutorial => [tutorial.id, tutorial.title]));
  const enrichedPage = page.map(row => ({
    ...row,
    user_email: row.user_id ? userEmails.get(row.user_id) ?? null : null,
    tutorial_title: row.tutorial_id ? tutorialTitles.get(row.tutorial_id) ?? null : null,
  }));

  // 최근 24시간 요약 — 전체 행을 가져오지 않고 정확한 개수를 집계한다.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const countBy = (column?: 'category' | 'level', value?: string) => {
    let countQuery = service.from('mm_logs').select('id', { count: 'exact', head: true }).gte('created_at', since);
    if (column && value) countQuery = countQuery.eq(column, value);
    return countQuery;
  };
  const [total, errorCount, network, audit, system, errorLevel, warnLevel] = await Promise.all([
    countBy(), countBy('category', 'error'), countBy('category', 'network'),
    countBy('category', 'audit'), countBy('category', 'system'),
    countBy('level', 'error'), countBy('level', 'warn'),
  ]);
  const countError = [total, errorCount, network, audit, system, errorLevel, warnLevel].find(result => result.error);
  if (countError?.error) {
    return NextResponse.json({ error: 'summary_query_failed' }, { status: 500 });
  }
  const summary = {
    total: total.count ?? 0,
    error: errorCount.count ?? 0,
    network: network.count ?? 0,
    audit: audit.count ?? 0,
    system: system.count ?? 0,
    errorLevel: errorLevel.count ?? 0,
    warnLevel: warnLevel.count ?? 0,
  };

  return NextResponse.json({ rows: enrichedPage, nextCursor, summary });
}

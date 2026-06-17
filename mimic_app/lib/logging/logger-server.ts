// 서버 로거 — API 라우트/서버 코드에서 사용.
//   error/warn: mm_logs(DB)에 직접 insert + 콘솔(Vercel 런타임 로그).
//   debug/info: 콘솔만.
//   절대 throw하지 않음 — await 없이 fire-and-forget로 호출해도 됨.
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { LogLevel, LogContext } from '@/lib/logger';

export async function logServer(level: LogLevel, event: string, ctx: LogContext = {}): Promise<void> {
  const { message, userId, tutorialId, url, ...rest } = ctx;
  const line = `[${level}] ${event}${message ? ` — ${message}` : ''}`;
  if (level === 'error') console.error(line, rest);
  else if (level === 'warn') console.warn(line, rest);
  else console.log(line, rest);

  if (level !== 'error' && level !== 'warn') return;

  try {
    const supabase = createServiceRoleClient();
    await supabase.from('mm_logs').insert({
      level,
      source: 'server',
      event,
      message: message ?? null,
      context: Object.keys(rest).length ? rest : null,
      user_id: (userId as string | null) ?? null,
      tutorial_id: (tutorialId as string | null) ?? null,
      url: (url as string | null) ?? null,
    });
  } catch {
    /* 로깅 실패는 무시 */
  }
}

export const logErrorServer = (event: string, ctx?: LogContext) => logServer('error', event, ctx ?? {});
export const logWarnServer  = (event: string, ctx?: LogContext) => logServer('warn',  event, ctx ?? {});

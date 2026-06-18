// 서버 로거 — API 라우트/서버 코드에서 사용.
//   category 'error'  : error/warn만 mm_logs(DB)에 저장 + 콘솔. debug/info는 콘솔만. (기존 동작)
//   category network/audit/system : 레벨과 무관하게 항상 mm_logs에 저장 (정상 동작 추적용) + 콘솔.
//   절대 throw하지 않음 — await 없이 fire-and-forget로 호출해도 됨.
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { LogLevel, LogContext, LogCategory } from '@/lib/logging/logger';

export async function logServer(
  level: LogLevel,
  event: string,
  ctx: LogContext = {},
  category: LogCategory = 'error'
): Promise<void> {
  const { message, userId, tutorialId, url, ...rest } = ctx;
  const line = `[${category}/${level}] ${event}${message ? ` — ${message}` : ''}`;
  if (level === 'error') console.error(line, rest);
  else if (level === 'warn') console.warn(line, rest);
  else console.log(line, rest);

  // error 카테고리는 error/warn만 영구 저장. 그 외 카테고리(network/audit/system)는 항상 저장.
  const shouldPersist = category === 'error' ? (level === 'error' || level === 'warn') : true;
  if (!shouldPersist) return;

  try {
    const supabase = createServiceRoleClient();
    await supabase.from('mm_logs').insert({
      level,
      category,
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

// 장애/예외 로그 (기존)
export const logErrorServer = (event: string, ctx?: LogContext) => logServer('error', event, ctx ?? {}, 'error');
export const logWarnServer  = (event: string, ctx?: LogContext) => logServer('warn',  event, ctx ?? {}, 'error');

// 감사 로그 — 로그인 성공/실패, 회원 탈퇴 등. 기본 info, 실패는 'warn' 지정.
export const logAudit   = (event: string, ctx?: LogContext, level: LogLevel = 'info') => logServer(level, event, ctx ?? {}, 'audit');
// 네트워크 로그 — Extension·외부서비스 호출 결과. 정상은 info, 실패는 'warn'/'error' 지정.
export const logNetwork = (event: string, ctx?: LogContext, level: LogLevel = 'info') => logServer(level, event, ctx ?? {}, 'network');
// 시스템 로그 — cron 등 시스템 동작. 정상은 info, 실패는 'warn'/'error' 지정.
export const logSystem  = (event: string, ctx?: LogContext, level: LogLevel = 'info') => logServer(level, event, ctx ?? {}, 'system');

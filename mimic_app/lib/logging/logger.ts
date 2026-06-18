// 클라이언트 로거 — 브라우저에서 사용.
//   error/warn: /api/logs로 전송해 mm_logs(DB)에 영구 저장 + 콘솔.
//   debug/info: 콘솔만.
//   절대 throw하지 않음 — 로깅 실패가 앱 동작을 막으면 안 됨.
//   페이지 이탈 중에도 전송되도록 navigator.sendBeacon 우선 사용.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'error' | 'network' | 'audit' | 'system';

export type LogContext = {
  message?: string;
  userId?: string | null;
  tutorialId?: string | null;
  // 임의 추가 컨텍스트 — PII 금지(ID·코드·상태값만)
  [k: string]: unknown;
};

function emit(level: LogLevel, event: string, ctx: LogContext = {}, category: LogCategory = 'error'): void {
  const { message, ...rest } = ctx;
  const line = `[${category}/${level}] ${event}${message ? ` — ${message}` : ''}`;
  if (level === 'error') console.error(line, rest);
  else if (level === 'warn') console.warn(line, rest);
  else console.debug(line, rest);

  // error 카테고리는 error/warn만 DB 전송. network/audit/system은 항상 전송.
  const shouldSend = category === 'error' ? (level === 'error' || level === 'warn') : true;
  if (!shouldSend) return;

  try {
    const body = JSON.stringify({
      level,
      category,
      event,
      message: message ?? null,
      context: Object.keys(rest).length ? rest : null,
      userId: ctx.userId ?? null,
      tutorialId: ctx.tutorialId ?? null,
      url: typeof location !== 'undefined' ? location.href : null,
    });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/logs', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* 로깅 실패는 무시 */
  }
}

export const logError = (event: string, ctx?: LogContext) => emit('error', event, ctx ?? {});
export const logWarn  = (event: string, ctx?: LogContext) => emit('warn',  event, ctx ?? {});
export const logInfo  = (event: string, ctx?: LogContext) => emit('info',  event, ctx ?? {});
export const logDebug = (event: string, ctx?: LogContext) => emit('debug', event, ctx ?? {});

// 카테고리 로그 (클라이언트) — 레벨과 무관하게 항상 /api/logs로 전송.
export const logAuditClient   = (event: string, ctx?: LogContext, level: LogLevel = 'info') => emit(level, event, ctx ?? {}, 'audit');
export const logNetworkClient = (event: string, ctx?: LogContext, level: LogLevel = 'info') => emit(level, event, ctx ?? {}, 'network');

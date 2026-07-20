import { BRAND_COPY } from '@/lib/brand';
import { resolvePreferredExtensionId } from '@/lib/extension-id';

type RuntimeResponse = {
  ok?: boolean;
  error?: string;
  gated?: boolean;
  limit?: number;
  upgradeUrl?: string;
};

export type LiveGuideResult =
  | { ok: true }
  | { ok: false; reason: 'not_installed' | 'gated' | 'timeout' | 'error'; message: string; upgradeUrl?: string };

type LiveGuideTargetRect = { x: number; y: number; width: number; height: number };
type LiveGuideTargetContext = Record<string, unknown>;

export type LiveGuideTargetTab = {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  urlAccess: boolean;
};

export type LiveGuideTargetPickResult =
  | {
      ok: true;
      page_url?: string;
      element_selector?: string | null;
      element_xpath?: string | null;
      element_rect?: LiveGuideTargetRect | null;
      target_context?: LiveGuideTargetContext | null;
      click_x?: number | null;
      click_y?: number | null;
      label?: string | null;
    }
  | { ok: false; reason: 'not_installed' | 'timeout' | 'error'; message: string };

type LiveGuideTargetTabsResult =
  | { ok: true; tabs: LiveGuideTargetTab[] }
  | { ok: false; reason: 'not_installed' | 'timeout' | 'error'; message: string };

type RuntimeMessageDelivery =
  | { timedOut: true }
  | { timedOut: false; response: unknown; lastError: string | null };

const RUNTIME_MESSAGE_TIMEOUT_MS = 8_000;
const TARGET_PICK_TIMEOUT_MS = 60_000;

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: unknown,
          callback: (response: unknown) => void
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
}

function sendRuntimeMessage(
  extensionId: string,
  message: unknown,
  timeoutMs: number,
): Promise<RuntimeMessageDelivery> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (result: RuntimeMessageDelivery) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(result);
    };
    const timeoutId = window.setTimeout(() => finish({ timedOut: true }), timeoutMs);

    try {
      window.chrome!.runtime!.sendMessage(extensionId, message, response => {
        finish({
          timedOut: false,
          response,
          lastError: window.chrome?.runtime?.lastError?.message ?? null,
        });
      });
    } catch (error) {
      finish({
        timedOut: false,
        response: null,
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

export async function startLiveGuide(shareToken: string, timeoutMs = RUNTIME_MESSAGE_TIMEOUT_MS): Promise<LiveGuideResult> {
  const extensionId = await resolvePreferredExtensionId();
  if (!extensionId || !window.chrome?.runtime?.sendMessage) {
    return Promise.resolve({
      ok: false,
      reason: 'not_installed',
      message: `${BRAND_COPY.extensionDisplayName} 확장 프로그램을 설치하거나 활성화한 뒤 다시 시도해주세요.`,
    });
  }

  const delivery = await sendRuntimeMessage(extensionId, { action: 'START_GUIDE', share_token: shareToken }, timeoutMs);
  if (delivery.timedOut) {
    return { ok: false, reason: 'timeout', message: 'Recorder 응답이 지연되고 있습니다. 확장 프로그램을 다시 로드한 뒤 재시도해주세요.' };
  }
  if (delivery.lastError) {
    return { ok: false, reason: 'not_installed', message: delivery.lastError };
  }

  const data = (delivery.response ?? {}) as RuntimeResponse;
  if (data.ok) return { ok: true };
  if (data.gated) {
    return {
      ok: false,
      reason: 'gated',
      message: `무료 라이브 가이드 Beta 실행 한도(${data.limit ?? 5}회)를 모두 사용했습니다.`,
      upgradeUrl: data.upgradeUrl,
    };
  }
  return { ok: false, reason: 'error', message: data.error ?? '라이브 가이드 Beta를 시작하지 못했습니다.' };
}

export async function listLiveGuideTargetTabs(timeoutMs = RUNTIME_MESSAGE_TIMEOUT_MS): Promise<LiveGuideTargetTabsResult> {
  const extensionId = await resolvePreferredExtensionId();
  if (!extensionId || !window.chrome?.runtime?.sendMessage) {
    return {
      ok: false,
      reason: 'not_installed',
      message: `${BRAND_COPY.extensionDisplayName} 확장 프로그램을 설치하거나 활성화한 뒤 다시 시도해주세요.`,
    };
  }

  const delivery = await sendRuntimeMessage(extensionId, { action: 'GET_TABS' }, timeoutMs);
  if (delivery.timedOut) {
    return { ok: false, reason: 'timeout', message: '대상 탭 목록을 불러오는 시간이 초과되었습니다. Recorder를 다시 로드한 뒤 재시도해주세요.' };
  }
  if (delivery.lastError) {
    return { ok: false, reason: 'not_installed', message: delivery.lastError };
  }

  const data = (delivery.response ?? {}) as RuntimeResponse & { tabs?: unknown[] };
  if (!data.ok || !Array.isArray(data.tabs)) {
    return { ok: false, reason: 'error', message: data.error ?? '대상 탭 목록을 불러오지 못했습니다.' };
  }

  const tabs = data.tabs.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== 'number' || typeof candidate.url !== 'string' || !/^https?:\/\//i.test(candidate.url)) return [];
    try {
      const parsed = new URL(candidate.url);
      const hostname = parsed.hostname.toLowerCase();
      if (parsed.origin === window.location.origin || hostname === 'parro-guide.vercel.app' || hostname === 'parro-guide-dev.vercel.app') return [];
    } catch {
      return [];
    }
    return [{
      id: candidate.id,
      title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : candidate.url,
      url: candidate.url,
      favIconUrl: typeof candidate.favIconUrl === 'string' ? candidate.favIconUrl : undefined,
      urlAccess: candidate.urlAccess !== false,
    } satisfies LiveGuideTargetTab];
  });
  return { ok: true, tabs };
}

export async function pickLiveGuideTarget(tabId: number, timeoutMs = TARGET_PICK_TIMEOUT_MS): Promise<LiveGuideTargetPickResult> {
  const extensionId = await resolvePreferredExtensionId();
  if (!extensionId || !window.chrome?.runtime?.sendMessage) {
    return Promise.resolve({
      ok: false,
      reason: 'not_installed',
      message: `${BRAND_COPY.extensionDisplayName} 확장 프로그램을 설치하거나 활성화한 뒤 다시 시도해주세요.`,
    });
  }

  const delivery = await sendRuntimeMessage(extensionId, { action: 'PICK_LIVE_TARGET', tab_id: tabId }, timeoutMs);
  if (delivery.timedOut) {
    return { ok: false, reason: 'timeout', message: '대상 요소 선택 시간이 초과되었습니다. 다시 선택해주세요.' };
  }
  if (delivery.lastError) {
    return { ok: false, reason: 'not_installed', message: delivery.lastError };
  }

  const data = (delivery.response ?? {}) as RuntimeResponse & Record<string, unknown>;
  if (data.ok) {
    return {
      ok: true,
      page_url: typeof data.page_url === 'string' ? data.page_url : undefined,
      element_selector: typeof data.element_selector === 'string' ? data.element_selector : null,
      element_xpath: typeof data.element_xpath === 'string' ? data.element_xpath : null,
      element_rect: data.element_rect as LiveGuideTargetRect | null,
      target_context: data.target_context && typeof data.target_context === 'object'
        ? data.target_context as LiveGuideTargetContext
        : null,
      click_x: typeof data.click_x === 'number' ? data.click_x : null,
      click_y: typeof data.click_y === 'number' ? data.click_y : null,
      label: typeof data.label === 'string' ? data.label : null,
    };
  }

  return {
    ok: false,
    reason: data.reason === 'timeout' ? 'timeout' : 'error',
    message: typeof data.error === 'string' ? data.error : '라이브 가이드 대상을 선택하지 못했습니다.',
  };
}

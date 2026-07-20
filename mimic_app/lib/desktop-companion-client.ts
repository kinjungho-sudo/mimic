import { BRAND_EXTENSION_IDS } from '@/lib/brand';

export interface DesktopCompanionResponse {
  ok?: boolean;
  sessionId?: string;
  desktop?: {
    host?: string;
    connected?: boolean;
    lastError?: string | null;
  };
  error?: string;
  tutorialId?: string;
  stepCount?: number;
  capturedSteps?: number;
  editorUrl?: string;
}

export function getDesktopExtensionId(): string {
  return getDesktopExtensionIds()[0] || '';
}

export function getDesktopExtensionIds(): string[] {
  const configured = process.env.NEXT_PUBLIC_EXTENSION_ID?.replace(/^\uFEFF/, '').trim();
  return Array.from(new Set([configured, ...BRAND_EXTENSION_IDS].filter((id): id is string => !!id)));
}

export function canTalkToDesktopExtension(): boolean {
  return typeof window !== 'undefined' && !!window.chrome?.runtime?.sendMessage && !!getDesktopExtensionId();
}

export function sendDesktopExtensionMessage(
  action: string,
  payload: Record<string, unknown> = {},
  timeoutMs = 5000,
): Promise<DesktopCompanionResponse | null> {
  return tryDesktopExtensionIds(getDesktopExtensionIds(), action, payload, timeoutMs);
}

async function tryDesktopExtensionIds(
  extensionIds: string[],
  action: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<DesktopCompanionResponse | null> {
  if (!extensionIds.length || typeof window === 'undefined' || !window.chrome?.runtime?.sendMessage) {
    return { error: 'extension_api_unavailable' };
  }

  let lastResponse: DesktopCompanionResponse | null = null;
  for (const extensionId of extensionIds) {
    const response = await sendToDesktopExtension(extensionId, action, payload, timeoutMs);
    lastResponse = response;
    if (!isExtensionConnectionError(response?.error)) return response;
  }
  return lastResponse || { error: 'extension_empty_response' };
}

function sendToDesktopExtension(
  extensionId: string,
  action: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<DesktopCompanionResponse> {
  return new Promise(resolve => {
    const runtime = window.chrome?.runtime;
    if (!runtime?.sendMessage) {
      resolve({ error: 'extension_api_unavailable' });
      return;
    }

    let settled = false;
    const finish = (response: DesktopCompanionResponse) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(response);
    };
    const timer = window.setTimeout(() => finish({ error: 'extension_response_timeout' }), timeoutMs);

    try {
      runtime.sendMessage(extensionId, { action, ...payload }, response => {
        const runtimeError = runtime.lastError?.message;
        if (runtimeError) {
          finish({ error: `extension_unreachable: ${runtimeError}` });
          return;
        }
        finish((response as DesktopCompanionResponse | undefined) || { error: 'extension_empty_response' });
      });
    } catch (error) {
      finish({ error: `extension_send_failed: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
}

export function isExtensionConnectionError(error: string | undefined): boolean {
  return !!error && (
    error === 'extension_api_unavailable'
    || error === 'extension_response_timeout'
    || error === 'extension_empty_response'
    || error.startsWith('extension_unreachable:')
    || error.startsWith('extension_send_failed:')
  );
}

export function desktopCompanionErrorMessage(error: string | undefined, fallback: string): string {
  switch (error) {
    case 'not_linked':
      return 'Parro에 로그인하고 Recorder를 계정에 연결한 뒤 다시 시도해주세요. 캡처 파일은 PC에 그대로 보관됩니다.';
    case 'desktop_capture_empty':
      return '저장된 캡처 단계가 없습니다. 캡처를 시작한 뒤 대상 앱을 한 번 이상 클릭해주세요.';
    case 'desktop_host_unavailable':
    case 'desktop_host_disconnected':
      return 'Desktop Companion에 연결하지 못했습니다. 앱 설치 상태를 확인한 뒤 다시 시도해주세요.';
    case 'desktop_host_timeout':
      return 'Desktop Companion 응답이 지연되고 있습니다. 캡처 파일은 보존되므로 잠시 후 다시 시도해주세요.';
    case 'nothing_to_undo':
      return '취소할 캡처 단계가 없습니다.';
    default:
      return error ? `${fallback} (${error})` : fallback;
  }
}

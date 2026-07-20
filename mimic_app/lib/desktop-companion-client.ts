import { BRAND_EXTENSION_IDS } from '@/lib/brand';

export interface DesktopCompanionResponse {
  ok?: boolean;
  sessionId?: string;
  recorderVersion?: string;
  desktop?: {
    host?: string;
    connected?: boolean;
    lastError?: string | null;
    version?: string | null;
  };
  error?: string;
  tutorialId?: string;
  stepCount?: number;
  capturedSteps?: number;
  editorUrl?: string;
}

export const DESKTOP_COMPANION_LATEST_VERSION =
  process.env.NEXT_PUBLIC_DESKTOP_LATEST_VERSION?.replace(/^\uFEFF/, '').trim() || '0.5.0';

export type DesktopCompanionCompatibility = 'current' | 'outdated' | 'unknown';

export type DesktopCaptureEntry =
  | { kind: 'ready'; installedVersion: string }
  | { kind: 'install_required'; error?: string }
  | { kind: 'update_required'; installedVersion: string | null }
  | { kind: 'paid_required' }
  | { kind: 'sign_in_required' }
  | { kind: 'check_failed'; error?: string };

function numericVersionParts(version: string): number[] | null {
  const normalized = version.trim().replace(/^v/i, '').split('-')[0];
  if (!/^\d+(?:\.\d+)*$/.test(normalized)) return null;
  return normalized.split('.').map(part => Number(part));
}

export function compareDesktopVersions(left: string, right: string): number | null {
  const leftParts = numericVersionParts(left);
  const rightParts = numericVersionParts(right);
  if (!leftParts || !rightParts) return null;
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

export function desktopCompanionCompatibility(
  installedVersion: string | null | undefined,
  latestVersion = DESKTOP_COMPANION_LATEST_VERSION,
): DesktopCompanionCompatibility {
  if (!installedVersion) return 'unknown';
  const comparison = compareDesktopVersions(installedVersion, latestVersion);
  if (comparison === null) return 'unknown';
  return comparison < 0 ? 'outdated' : 'current';
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

export async function resolveDesktopCaptureEntry(): Promise<DesktopCaptureEntry> {
  try {
    const planResponse = await fetch('/api/user/plan', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (planResponse.status === 401) return { kind: 'sign_in_required' };
    if (!planResponse.ok) {
      return { kind: 'check_failed', error: `plan_check_${planResponse.status}` };
    }

    const plan = await planResponse.json() as { paid?: boolean };
    if (!plan.paid) return { kind: 'paid_required' };

    const response = await sendDesktopExtensionMessage('DESKTOP_COMPANION_STATUS');
    if (!response?.desktop?.connected) {
      return {
        kind: 'install_required',
        error: response?.desktop?.lastError || response?.error,
      };
    }

    const installedVersion = response.desktop.version?.trim() || null;
    const compatibility = desktopCompanionCompatibility(installedVersion);
    if (compatibility !== 'current') {
      return { kind: 'update_required', installedVersion };
    }
    return { kind: 'ready', installedVersion: installedVersion! };
  } catch (error) {
    return {
      kind: 'check_failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function desktopCaptureEntryDestination(entry: DesktopCaptureEntry, source: string): string {
  const safeSource = encodeURIComponent(source);
  switch (entry.kind) {
    case 'ready':
      return `/desktop-setup?source=${safeSource}&autostart=1`;
    case 'update_required': {
      const installed = entry.installedVersion
        ? `&installedVersion=${encodeURIComponent(entry.installedVersion)}`
        : '';
      return `/download/desktop?source=${safeSource}&reason=update${installed}`;
    }
    case 'paid_required':
      return `/landingpage?feature=desktop&source=${safeSource}#pricing`;
    case 'sign_in_required': {
      const next = encodeURIComponent(`/download/desktop?source=${source}`);
      return `/auth/login?next=${next}`;
    }
    case 'install_required':
      return `/download/desktop?source=${safeSource}&reason=install`;
    default:
      return `/download/desktop?source=${safeSource}&reason=check`;
  }
}

export function desktopCompanionErrorMessage(error: string | undefined, fallback: string): string {
  switch (error) {
    case 'desktop_paid_plan_required':
      return 'Desktop Companion은 유료 플랜에서 사용할 수 있습니다. 요금제를 확인한 뒤 다시 시도해주세요.';
    case 'desktop_update_required':
      return `Desktop Companion을 최신 버전(${DESKTOP_COMPANION_LATEST_VERSION})으로 업데이트한 뒤 다시 시도해주세요.`;
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

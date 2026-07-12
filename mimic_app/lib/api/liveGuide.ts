import { BRAND_COPY } from '@/lib/brand';
import { getPreferredExtensionId } from '@/lib/extension-id';

type RuntimeResponse = {
  ok?: boolean;
  error?: string;
  gated?: boolean;
  limit?: number;
  upgradeUrl?: string;
};

export type LiveGuideResult =
  | { ok: true }
  | { ok: false; reason: 'not_installed' | 'gated' | 'error'; message: string; upgradeUrl?: string };

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

export function startLiveGuide(shareToken: string): Promise<LiveGuideResult> {
  const extensionId = getPreferredExtensionId();
  if (!extensionId || !window.chrome?.runtime?.sendMessage) {
    return Promise.resolve({
      ok: false,
      reason: 'not_installed',
      message: `${BRAND_COPY.extensionDisplayName} 확장 프로그램을 설치하거나 활성화한 뒤 다시 시도해주세요.`,
    });
  }

  return new Promise(resolve => {
    window.chrome!.runtime!.sendMessage(
      extensionId,
      { action: 'START_GUIDE', share_token: shareToken },
      response => {
        const lastError = window.chrome?.runtime?.lastError;
        if (lastError) {
          resolve({ ok: false, reason: 'not_installed', message: lastError.message ?? '확장 프로그램이 응답하지 않았습니다.' });
          return;
        }

        const data = (response ?? {}) as RuntimeResponse;
        if (data.ok) {
          resolve({ ok: true });
          return;
        }

        if (data.gated) {
          resolve({
            ok: false,
            reason: 'gated',
            message: `무료 라이브 가이드 Beta 실행 한도(${data.limit ?? 5}회)를 모두 사용했습니다.`,
            upgradeUrl: data.upgradeUrl,
          });
          return;
        }

        resolve({ ok: false, reason: 'error', message: data.error ?? '라이브 가이드 Beta를 시작하지 못했습니다.' });
      }
    );
  });
}

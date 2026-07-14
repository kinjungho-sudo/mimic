'use client';

import { useState, useEffect, useCallback } from 'react';
import { installExtensionIdListener, resolvePreferredExtensionId, rememberExtensionId } from '@/lib/extension-id';

// 'not_installed' : chrome.runtime 자체가 없거나 확장이 응답 안 함
// 'error'         : 확장은 있는데 토큰 발급 등 서버 오류
type LinkState = 'loading' | 'success' | 'not_installed' | 'error';

export type ExtensionLinkState = {
  state: LinkState;
  countdown: number;
  retry: () => void;
};

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

function isExtensionInstalled(): boolean {
  return !!(window.chrome?.runtime?.sendMessage);
}

export function useExtensionLink(onSuccess: () => void): ExtensionLinkState {
  const [state, setState] = useState<LinkState>('loading');
  const [countdown, setCountdown] = useState(3);

  const attempt = useCallback(async () => {
    setState('loading');

    const extensionId = await resolvePreferredExtensionId();

    // 확장 자체가 없는 경우 — 웹스토어 미등록 기간 중 바이패스
    if (!extensionId || !isExtensionInstalled()) {
      setState('success');
      return;
    }

    // 토큰 발급
    let token: string;
    try {
      const res = await fetch('/api/extension/link', { method: 'POST' });
      if (!res.ok) { setState('error'); return; }
      const data = await res.json();
      token = data.token;
    } catch {
      setState('error');
      return;
    }

    // 확장에 토큰 전달 — LINK_USER로 link 토큰 전달 → 확장이 redeem 호출해서 session_token 저장
    window.chrome!.runtime!.sendMessage(
      extensionId,
      { action: 'LINK_USER', token },
      (resp) => {
        if (window.chrome?.runtime?.lastError) {
          // 확장이 설치 안 됐거나 비활성화된 경우
          setState('not_installed');
          return;
        }
        const ok = resp && typeof resp === 'object' && (resp as Record<string, unknown>).ok;
        if (ok) rememberExtensionId(extensionId);
        setState(ok ? 'success' : 'error');
      }
    );
  }, []);

  useEffect(() => {
    const cleanupExtensionIdListener = installExtensionIdListener();
    attempt();
    return cleanupExtensionIdListener;
  }, [attempt]);

  useEffect(() => {
    if (state !== 'success') return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          onSuccess();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state, onSuccess]);

  return { state, countdown, retry: attempt };
}

'use client';

// 운영(Production)에서만 확장 연동을 강제하는 게이트.
// Vercel Production env에 NEXT_PUBLIC_REQUIRE_EXTENSION=1 일 때만 켜진다.
// 로컬(npm run dev)·Preview(dev)는 값이 없어 게이트가 꺼진다 → 확장(개발자 버전) 없이도 작업 가능.

const REQUIRE_EXTENSION =
  process.env.NEXT_PUBLIC_REQUIRE_EXTENSION?.replace(/^﻿/, '').trim() === '1';
const EXT_ID = process.env.NEXT_PUBLIC_EXTENSION_ID?.replace(/^﻿/, '').trim();

type ChromeRuntime = {
  runtime?: {
    sendMessage?: (id: string, msg: unknown, cb: (r: unknown) => void) => void;
    lastError?: { message?: string };
  };
};

export function extensionGateOn(): boolean {
  return REQUIRE_EXTENSION;
}

// 확장에 CONNECT ping — 응답이 있으면 설치/연동된 것. (chrome.runtime은 모든 크롬에 존재하므로
// 단순 존재 확인이 아니라 실제 응답/lastError로 우리 확장 여부를 판별한다.)
function pingOnce(): Promise<boolean> {
  return new Promise(resolve => {
    const chrome = (window as unknown as { chrome?: ChromeRuntime }).chrome;
    if (!EXT_ID || !chrome?.runtime?.sendMessage) { resolve(false); return; }
    const timer = setTimeout(() => resolve(false), 3000);
    try {
      chrome.runtime.sendMessage(EXT_ID, { action: 'CONNECT' }, (resp: unknown) => {
        clearTimeout(timer);
        if (chrome.runtime?.lastError) { resolve(false); return; }
        resolve(!!resp);
      });
    } catch { clearTimeout(timer); resolve(false); }
  });
}

// Service Worker가 잠들어 첫 ping이 실패할 수 있어 몇 번 재시도해 깨운다.
async function isExtensionLinked(retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    if (await pingOnce()) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

// 진행 허용이면 true. 운영에서 미연동이면 설치+연동 페이지로 보내고 false 반환.
export async function ensureExtension(router: { push: (path: string) => void }): Promise<boolean> {
  if (!REQUIRE_EXTENSION) return true;
  if (await isExtensionLinked()) return true;
  router.push('/extension-link');
  return false;
}

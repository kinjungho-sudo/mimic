export async function requestExtensionLink(): Promise<{ token: string; expiresAt: string }> {
  const res = await fetch('/api/extension/link', { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Extension link failed');
  }
  return res.json();
}

// chrome.runtime.sendMessage로 확장에 토큰 전달
export async function sendTokenToExtension(token: string): Promise<boolean> {
  const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
  if (!extensionId) {
    console.warn('NEXT_PUBLIC_EXTENSION_ID not set');
    return false;
  }

  return new Promise(resolve => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).chrome?.runtime?.sendMessage(
        extensionId,
        { action: 'LINK_USER', token },
        (response: unknown) => {
          resolve(!!response);
        }
      );
    } catch {
      resolve(false);
    }
  });
}

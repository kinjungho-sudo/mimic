const EXTENSION_ID_STORAGE_KEY = 'parro_extension_id';
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const EXTENSION_MESSAGE_SOURCE = 'PARRO_RECORDER_EXTENSION';
const WEBAPP_MESSAGE_SOURCE = 'PARRO_WEBAPP';

function cleanExtensionId(value?: string | null) {
  const id = value?.replace(/^\uFEFF/, '').trim() ?? '';
  return EXTENSION_ID_PATTERN.test(id) ? id : '';
}

function allowsDynamicExtensionId() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === 'parro-guide.vercel.app'
    || (host.endsWith('.vercel.app') && host !== 'mimic-nine-ashen.vercel.app');
}

export function getPreferredExtensionId() {
  const configured = cleanExtensionId(process.env.NEXT_PUBLIC_EXTENSION_ID);
  if (typeof window === 'undefined' || !allowsDynamicExtensionId()) return configured;

  const params = new URLSearchParams(window.location.search);
  const fromQuery = cleanExtensionId(params.get('extension_id'));
  if (fromQuery) return fromQuery;

  const fromStorage = cleanExtensionId(window.localStorage.getItem(EXTENSION_ID_STORAGE_KEY));
  return fromStorage || configured;
}

export function rememberExtensionId(extensionId: string) {
  if (typeof window === 'undefined' || !allowsDynamicExtensionId()) return;
  const id = cleanExtensionId(extensionId);
  if (id) window.localStorage.setItem(EXTENSION_ID_STORAGE_KEY, id);
}

export function requestExtensionIdBroadcast() {
  if (typeof window === 'undefined' || !allowsDynamicExtensionId()) return;
  window.postMessage({
    source: WEBAPP_MESSAGE_SOURCE,
    type: 'REQUEST_EXTENSION_ID',
  }, window.location.origin);
}

export function installExtensionIdListener() {
  if (typeof window === 'undefined' || !allowsDynamicExtensionId()) return () => {};

  const onMessage = (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data as { source?: string; type?: string; extensionId?: string } | null;
    if (data?.source !== EXTENSION_MESSAGE_SOURCE || data.type !== 'EXTENSION_ID') return;
    rememberExtensionId(data.extensionId || '');
  };

  window.addEventListener('message', onMessage);
  requestExtensionIdBroadcast();
  return () => window.removeEventListener('message', onMessage);
}

export function resolvePreferredExtensionId(timeoutMs = 400): Promise<string> {
  const current = getPreferredExtensionId();
  if (current || typeof window === 'undefined' || !allowsDynamicExtensionId()) {
    return Promise.resolve(current);
  }

  return new Promise(resolve => {
    let done = false;
    const finish = (extensionId = '') => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMessage);
      resolve(extensionId || getPreferredExtensionId());
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; type?: string; extensionId?: string } | null;
      if (data?.source !== EXTENSION_MESSAGE_SOURCE || data.type !== 'EXTENSION_ID') return;
      const id = cleanExtensionId(data.extensionId);
      if (!id) return;
      rememberExtensionId(id);
      finish(id);
    };

    window.addEventListener('message', onMessage);
    requestExtensionIdBroadcast();
    window.setTimeout(() => finish(), timeoutMs);
  });
}

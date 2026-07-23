import { BRAND_EXTENSION_ID } from '@/lib/brand';

const EXTENSION_ID_STORAGE_KEY = 'parro_extension_id';
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const EXTENSION_MESSAGE_SOURCE = 'PARRO_RECORDER_EXTENSION';
const WEBAPP_MESSAGE_SOURCE = 'PARRO_WEBAPP';

function cleanExtensionId(value?: string | null) {
  const id = value?.replace(/^\uFEFF/, '').trim() ?? '';
  return EXTENSION_ID_PATTERN.test(id) ? id : '';
}

function allowsDynamicExtensionId(host: string) {
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === 'parro-guide-dev.vercel.app';
}

interface ExtensionIdSelection {
  hostname: string;
  configured?: string | null;
  query?: string | null;
  stored?: string | null;
}

export function selectPreferredExtensionId({
  hostname,
  configured,
  query,
  stored,
}: ExtensionIdSelection) {
  // Production always talks to the stable Chrome Web Store item. Recorder
  // versions can update independently because the extension ID does not change.
  if (!allowsDynamicExtensionId(hostname)) return BRAND_EXTENSION_ID;

  return cleanExtensionId(query)
    || cleanExtensionId(stored)
    || cleanExtensionId(configured);
}

export function getPreferredExtensionId() {
  if (typeof window === 'undefined') return BRAND_EXTENSION_ID;

  const params = new URLSearchParams(window.location.search);
  return selectPreferredExtensionId({
    hostname: window.location.hostname,
    configured: process.env.NEXT_PUBLIC_EXTENSION_ID,
    query: params.get('extension_id'),
    stored: window.localStorage.getItem(EXTENSION_ID_STORAGE_KEY),
  });
}

export function rememberExtensionId(extensionId: string) {
  if (typeof window === 'undefined' || !allowsDynamicExtensionId(window.location.hostname)) return;
  const id = cleanExtensionId(extensionId);
  if (id) window.localStorage.setItem(EXTENSION_ID_STORAGE_KEY, id);
}

export function requestExtensionIdBroadcast() {
  if (typeof window === 'undefined' || !allowsDynamicExtensionId(window.location.hostname)) return;
  window.postMessage({
    source: WEBAPP_MESSAGE_SOURCE,
    type: 'REQUEST_EXTENSION_ID',
  }, window.location.origin);
}

export function installExtensionIdListener() {
  if (typeof window === 'undefined' || !allowsDynamicExtensionId(window.location.hostname)) return () => {};

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
  if (
    current
    || typeof window === 'undefined'
    || !allowsDynamicExtensionId(window.location.hostname)
  ) {
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

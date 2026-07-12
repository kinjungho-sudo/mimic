const EXTENSION_ID_STORAGE_KEY = 'parro_extension_id';
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

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

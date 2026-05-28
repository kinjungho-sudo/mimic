const SUPABASE_HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
  .toLowerCase()
  .replace(/\.$/, '');

export function assertStorageUrl(url: string | null | undefined): string {
  if (!url) throw new Error('Missing URL');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'https:') throw new Error('Non-HTTPS URL');
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (host !== SUPABASE_HOST) throw new Error('Untrusted host');
  return url;
}

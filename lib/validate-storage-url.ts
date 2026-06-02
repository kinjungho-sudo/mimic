function getSupabaseHost(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return '';
  try {
    return new URL(raw).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return '';
  }
}

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
  const supabaseHost = getSupabaseHost();
  if (supabaseHost && host !== supabaseHost) throw new Error('Untrusted host');
  return url;
}

import type { NextRequest } from 'next/server';

export type ServerLocale = 'ko' | 'en';

export function normalizeServerLocale(value: string | null | undefined): ServerLocale {
  return value?.toLowerCase().startsWith('en') ? 'en' : 'ko';
}

export function getRequestLocale(request: NextRequest): ServerLocale {
  return normalizeServerLocale(
    request.nextUrl.searchParams.get('locale')
      ?? request.cookies.get('parro.locale')?.value
      ?? request.headers.get('accept-language'),
  );
}

export function localeTag(locale: ServerLocale): 'ko-KR' | 'en-US' {
  return locale === 'en' ? 'en-US' : 'ko-KR';
}

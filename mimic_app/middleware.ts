import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasEntitlement } from './lib/entitlements';

const clean = (v: string | undefined) => v?.replace(/^﻿/, '').trim() ?? '';

const PROTECTED = [
  '/editor',
  '/manual',
  '/mypage',
  '/extension-link',
  '/settings',
  '/download',
  '/downloads',
  '/desktop-setup',
  '/desktop-import',
];

const PAID_DESKTOP_PATHS = [
  '/download/desktop',
  '/downloads/ParroDesktopSetup.exe',
  '/desktop-setup',
  '/desktop-import',
];

function isPaidDesktopPath(pathname: string): boolean {
  return PAID_DESKTOP_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      auth: { flowType: 'pkce' },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headersToSet).forEach(([name, value]) =>
            supabaseResponse.headers.set(name, value)
          );
        },
      },
    }
  );

  const {
    data: claimsData,
  } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;
  const userEmail = typeof claims?.email === 'string' ? claims.email : null;

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(
    p => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    const next = pathname.startsWith('/downloads/')
      ? '/download/desktop'
      : `${pathname}${request.nextUrl.search}`;
    url.searchParams.set('next', next);
    return NextResponse.redirect(url);
  }

  if (userId && isPaidDesktopPath(pathname)) {
    const { data: profile } = await supabase
      .from('mm_users')
      .select('plan')
      .eq('id', userId)
      .single();
    const paid = hasEntitlement(profile?.plan, 'desktop_companion');
    if (!paid) {
      const url = request.nextUrl.clone();
      url.pathname = '/landingpage';
      url.search = '';
      url.searchParams.set('feature', 'desktop');
      url.searchParams.set('source', 'paid-gate');
      url.hash = 'pricing';
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith('/admin')) {
    if (!userId) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
    if (userEmail !== clean(process.env.ADMIN_EMAIL)) {
      const url = request.nextUrl.clone();
      url.pathname = '/forbidden/admin';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|auth/callback).*)'],
};

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

const SUPABASE_REQUEST_TIMEOUT_MS = 4_000;

const PAID_DESKTOP_PATHS = [
  '/download/desktop',
  '/downloads/ParroDesktopSetup.exe',
  '/desktop-setup',
  '/desktop-import',
];

function isPaidDesktopPath(pathname: string): boolean {
  return PAID_DESKTOP_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`));
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = '/auth/login';
  const next = pathname.startsWith('/downloads/')
    ? '/download/desktop'
    : `${pathname}${request.nextUrl.search}`;
  url.searchParams.set('next', next);
  return NextResponse.redirect(url);
}

async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);

  if (upstreamSignal?.aborted) {
    abortFromUpstream();
  } else {
    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
  }

  const timeout = setTimeout(
    () => controller.abort(new Error('Supabase request timed out')),
    SUPABASE_REQUEST_TIMEOUT_MS
  );

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(
    p => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  // Anonymous public requests do not need an external auth lookup. This keeps
  // landing and shared pages available even if the auth provider is degraded.
  if (!hasSupabaseAuthCookie(request)) {
    if (isProtected || isAdmin) {
      return redirectToLogin(request, pathname);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      auth: { flowType: 'pkce' },
      global: { fetch: fetchWithTimeout },
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

  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;
    userId = typeof claims?.sub === 'string' ? claims.sub : null;
    userEmail = typeof claims?.email === 'string' ? claims.email : null;
  } catch (error) {
    console.error(
      '[Parro][middleware] Supabase auth unavailable:',
      error instanceof Error ? error.message : 'unknown error'
    );
    if (!isProtected && !isAdmin) {
      return supabaseResponse;
    }
  }

  if (isProtected && !userId) {
    return redirectToLogin(request, pathname);
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

  if (isAdmin) {
    if (!userId) {
      return redirectToLogin(request, pathname);
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

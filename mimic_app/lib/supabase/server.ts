import { createServerClient as _createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const clean = (v: string | undefined) => v?.replace(/^﻿/, '').trim() ?? '';

export async function createServerClient() {
  const cookieStore = await cookies();

  return _createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      auth: { flowType: 'pkce' },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components에서는 쿠키 설정 불가 — 무시
          }
        },
      },
    }
  );
}

// Service Role 클라이언트 — API Route에서만 사용. 클라이언트 코드에서 import 금지.
export function createServiceRoleClient() {
  return createServiceClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

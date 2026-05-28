import { createBrowserClient } from '@supabase/ssr';

const clean = (v: string | undefined) => v?.replace(/^﻿/, '').trim() ?? '';

export function createClient() {
  return createBrowserClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

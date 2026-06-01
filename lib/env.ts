const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
];

const clean = (v: string | undefined) => v?.replace(/^﻿/, '').trim() ?? '';

export function validateEnv() {
  const missing = required.filter(key => !clean(process.env[key]));
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

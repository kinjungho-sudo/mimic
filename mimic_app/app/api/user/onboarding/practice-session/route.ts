import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  PARRO_ONBOARDING_KEY,
  PARRO_ONBOARDING_PRACTICE_PATH,
  PARRO_ONBOARDING_VERSION,
} from '@/lib/onboarding';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();
  const token = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('mm_user_onboarding_progress')
    .update({
      practice_capture_token: token,
      practice_capture_token_issued_at: now,
      practice_capture_consumed_at: null,
    })
    .eq('user_id', auth.userId)
    .eq('guide_key', PARRO_ONBOARDING_KEY)
    .eq('guide_version', PARRO_ONBOARDING_VERSION)
    .eq('status', 'in_progress')
    .select('user_id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed to prepare practice recording' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Start the Live Guide first' }, { status: 409 });
  }

  return NextResponse.json({
    practice_url: `${PARRO_ONBOARDING_PRACTICE_PATH}?guide=${encodeURIComponent(PARRO_ONBOARDING_KEY)}`,
    onboarding_token: token,
  });
}


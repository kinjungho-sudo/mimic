import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

// GET /api/extension/me — 확장이 현재 사용자 정보(플랜)를 조회.
// PRO 전용 기능(캡처별 음성 메모 등) 게이팅에 사용. extensionToken(Bearer)으로 인증.
export async function GET(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('mm_users')
    .select('plan')
    .eq('id', auth.userId)
    .single();

  const plan = data?.plan ?? 'free';
  // PRO+ 여부 — pro/enterprise만 true (free·pro_waitlist·basic 제외)
  const isPro = plan === 'pro' || plan === 'enterprise';

  return NextResponse.json({ plan, isPro });
}

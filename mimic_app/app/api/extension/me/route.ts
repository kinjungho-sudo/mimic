import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isPaidPlan } from '@/lib/plan';

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
  // 기존 확장 계약의 isPro 필드명은 유지하되 모든 유료 플랜을 포함한다.
  const isPro = isPaidPlan(plan);

  return NextResponse.json({ plan, paid: isPro, isPro });
}

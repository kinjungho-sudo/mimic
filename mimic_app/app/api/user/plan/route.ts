import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  plan: z.enum(['free', 'pro_waitlist', 'pro', 'team']),
});

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Pro/Team 플랜은 daily_limit 제한 없음 (99999), Free는 3
  const daily_limit = parsed.data.plan === 'pro' || parsed.data.plan === 'team' ? 99999 : 3;

  const { error } = await supabase
    .from('mm_users')
    .update({ plan: parsed.data.plan, daily_limit })
    .eq('id', auth.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plan: parsed.data.plan, daily_limit });
}

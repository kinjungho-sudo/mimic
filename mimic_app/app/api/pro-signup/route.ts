import { NextRequest, NextResponse } from 'next/server';
import { proSignupSchema } from '@/lib/validators';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = proSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // 중복 체크 — 같은 이메일 + 같은 plan
  const { data: existing } = await supabase
    .from('mm_pro_signups')
    .select('id')
    .eq('email', parsed.data.email)
    .eq('plan_interested', parsed.data.plan_interested)
    .single();

  if (existing) {
    return NextResponse.json({ success: true, message: '이미 사전예약이 완료되었습니다.' });
  }

  const { error } = await supabase.from('mm_pro_signups').insert({
    email: parsed.data.email,
    plan_interested: parsed.data.plan_interested,
    source: parsed.data.source,
    user_id: parsed.data.user_id ?? null,
  });
  if (error) return NextResponse.json({ error: '사전예약 저장에 실패했습니다.' }, { status: 500 });

  return NextResponse.json({ success: true, message: '사전예약 완료' });
}

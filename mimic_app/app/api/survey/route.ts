import { NextRequest, NextResponse } from 'next/server';
import { surveySchema } from '@/lib/validators';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { rateLimitPublic } from '@/lib/rate-limit';
import { isKnownGuideId } from '@/lib/analytics/known-guide';

export async function POST(request: NextRequest) {
  const limited = await rateLimitPublic(request, 'survey', 20, 10 * 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = surveySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  // 실제 매뉴얼(또는 플레이북) 기록만 받는다 — 임의 UUID로 분석 데이터를 오염시키지 못하게 한다.
  if (!(await isKnownGuideId(supabase, parsed.data.tutorial_id))) {
    return new NextResponse(null, { status: 204 });
  }

  await supabase.from('mm_survey_responses').insert(parsed.data);

  return new NextResponse(null, { status: 204 });
}

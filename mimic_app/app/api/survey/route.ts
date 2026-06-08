import { NextRequest, NextResponse } from 'next/server';
import { surveySchema } from '@/lib/validators';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
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
  await supabase.from('mm_survey_responses').insert(parsed.data);

  return new NextResponse(null, { status: 204 });
}

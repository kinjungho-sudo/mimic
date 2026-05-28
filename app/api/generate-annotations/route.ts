import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { generateAnnotationsSchema } from '@/lib/validators';
import { generateAnnotations } from '@/lib/claude';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { rateLimitAi } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimitAi(auth.userId);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = generateAnnotationsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { stepId, userPrompt } = parsed.data;

  // 스텝 컨텍스트 가져오기
  const supabase = createServiceRoleClient();
  const { data: step } = await supabase
    .from('mm_steps')
    .select('ai_title, ai_description, page_url')
    .eq('id', stepId)
    .single();

  const stepContext = step
    ? `제목: ${step.ai_title}, 설명: ${step.ai_description}, URL: ${step.page_url}`
    : '';

  try {
    const annotations = await generateAnnotations(userPrompt, stepContext);

    // DB에 저장
    if (annotations.length > 0) {
      await supabase.from('mm_annotations').insert(
        annotations.map((a: Record<string, unknown>) => ({ ...a, step_id: stepId }))
      );
    }

    return NextResponse.json({ annotations });
  } catch (err) {
    console.error('generate-annotations error:', err);
    return NextResponse.json({ error: 'Annotation generation failed' }, { status: 500 });
  }
}

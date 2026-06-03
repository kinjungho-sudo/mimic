import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { generateAnnotationsSchema } from '@/lib/validators';
import { generateAnnotations } from '@/lib/claude';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { rateLimitAi } from '@/lib/rate-limit';
import { toEditorAnnotation } from '@/lib/annotations';

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

  // 스텝 컨텍스트 가져오기 (좌표 필드 포함)
  const supabase = createServiceRoleClient();
  const { data: step } = await supabase
    .from('mm_steps')
    .select('ai_title, ai_description, page_url, click_x, click_y, element_rect, viewport_w, viewport_h, element_selector')
    .eq('id', stepId)
    .single();

  const stepContext = step
    ? `제목: ${step.ai_title}, 설명: ${step.ai_description}, URL: ${step.page_url}`
    : '';

  // click_x/y는 DB에 0~10000 정수로 저장됨 → 0~1로 환산
  const locationData = step ? {
    clickX:          step.click_x != null ? step.click_x / 10000 : null,
    clickY:          step.click_y != null ? step.click_y / 10000 : null,
    elementRect:     step.element_rect ?? null,
    actionType:      null,
    actionLabel:     step.ai_title ?? null,
  } : undefined;

  try {
    const rawAnnotations = await generateAnnotations(userPrompt, stepContext, locationData);
    const annotations = (rawAnnotations as Record<string, unknown>[]).map(toEditorAnnotation);

    // DB에 저장
    if (rawAnnotations.length > 0) {
      await supabase.from('mm_annotations').insert(
        (rawAnnotations as Record<string, unknown>[]).map((a) => ({ ...a, step_id: stepId }))
      );
    }

    return NextResponse.json({ annotations });
  } catch (err) {
    console.error('generate-annotations error:', err);
    return NextResponse.json({ error: 'Annotation generation failed' }, { status: 500 });
  }
}

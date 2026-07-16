import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateDraft } from '@/lib/ai/claude';
import { isLowQualityCaptureTutorialTitle } from '@/lib/ai/capture-fallback';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();

  if (!tutorial) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: steps } = await supabase
    .from('mm_steps')
    .select('id, user_title, ai_title, user_script, ai_description, page_url, step_number, domain_name, type_text')
    .eq('tutorial_id', id)
    .order('step_number', { ascending: true });

  if (!steps?.length) return NextResponse.json({ error: 'No steps' }, { status: 422 });

  // generateDraft는 단일 GPT-5.6 Luna 호출로 제목+스텝 본문을 생성 — 여기선 tutorial_title만 사용
  const draftResult = await generateDraft(steps.map(step => ({
    id: step.id,
    step_number: step.step_number,
    ai_title: step.user_title || step.ai_title,
    ai_description: step.user_script || step.ai_description,
    page_url: step.page_url,
    domain_name: step.domain_name,
    element_text: step.type_text,
  })));
  const tutorialTitle = draftResult.tutorial_title.trim();
  if (draftResult.status !== 'ok' || isLowQualityCaptureTutorialTitle(tutorialTitle)) {
    return NextResponse.json(
      { error: '목적 중심 제목 생성에 실패했습니다. 다시 시도해주세요.', reason: draftResult.status },
      { status: draftResult.status === 'missing_key' ? 503 : 502 }
    );
  }

  const { error } = await supabase
    .from('mm_tutorials')
    .update({ title: tutorialTitle })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ title: tutorialTitle });
}

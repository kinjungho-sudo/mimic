import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardStepAccess } from '@/lib/auth/workspace-guard';
import { generateDraft, hasOpenAIApiKey } from '@/lib/ai/claude';
import { isLowQualityManualTitle, validateGeneratedManualScript } from '@/lib/ai/text-quality';
import { rateLimitAi } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimitAi(auth.userId);
  if (limited) return limited;

  if (!hasOpenAIApiKey()) {
    return NextResponse.json({ error: 'AI provider is not configured' }, { status: 503 });
  }

  // 워크스페이스/공유 협업자도 editor 이상이면 AI 설명 생성 허용 (다른 스텝 라우트와 일관)
  const access = await guardStepAccess(id, auth.userId, 'editor');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const supabase = createServiceRoleClient();

  const { data: step } = await supabase
    .from('mm_steps')
    .select('id, tutorial_id')
    .eq('id', id)
    .single();

  if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 한 단계만 따로 해석하면 DOM 라벨을 제목/본문으로 복사하기 쉽다. 같은 매뉴얼의
  // 전체 흐름을 Luna에 전달한 뒤 요청된 단계의 결과만 저장한다.
  const { data: tutorialSteps } = await supabase
    .from('mm_steps')
    .select('id, step_number, user_title, ai_title, user_script, ai_description, page_url, domain_name')
    .eq('tutorial_id', step.tutorial_id)
    .order('step_number', { ascending: true });

  if (!tutorialSteps?.length) {
    return NextResponse.json({ error: 'No steps' }, { status: 422 });
  }

  const draftResult = await generateDraft(tutorialSteps.map(item => ({
    id: item.id,
    step_number: item.step_number,
    ai_title: item.user_title || item.ai_title,
    ai_description: item.user_script || item.ai_description,
    page_url: item.page_url,
    domain_name: item.domain_name,
  })));
  if (draftResult.status !== 'ok') {
    return NextResponse.json(
      { error: 'AI description generation failed', reason: draftResult.status },
      { status: draftResult.status === 'missing_key' ? 503 : 502 }
    );
  }

  const generated = draftResult.steps.find(item => item.id === id);
  const quality = validateGeneratedManualScript(generated?.user_script);
  if (!quality.ok) {
    return NextResponse.json(
      { error: 'AI description was empty or low quality', reason: quality.reason },
      { status: 422 }
    );
  }

  const generatedTitle = generated?.user_title?.trim() || '';
  const patch: { ai_description: string; user_script: string; user_title?: string } = {
    ai_description: quality.text,
    user_script: quality.text,
  };
  if (!isLowQualityManualTitle(generatedTitle)) patch.user_title = generatedTitle;

  const { error } = await supabase.from('mm_steps').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to save generated description' }, { status: 500 });

  return NextResponse.json({ description: quality.text, title: patch.user_title ?? null });
}

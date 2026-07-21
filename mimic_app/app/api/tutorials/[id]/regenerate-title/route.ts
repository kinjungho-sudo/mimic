import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateDraft } from '@/lib/ai/claude';
import { isLowQualityCaptureTutorialTitle } from '@/lib/ai/capture-fallback';
import { requireTutorialEntitlement } from '@/lib/auth/entitlement-guard';

type Params = { params: Promise<{ id: string }> };

type DraftStepEvidence = {
  screenshot_url?: string | null;
  element_text?: string | null;
  action_info?: {
    type?: string;
    label?: string;
    targetContext?: {
      captureSurface?: 'web' | 'desktop';
      captureApp?: string | null;
      accessibleName?: string | null;
      contextLabel?: string | null;
      pageTitle?: string | null;
    };
  } | null;
};

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();
  const entitlement = await requireTutorialEntitlement(id, 'ai_rewrite', supabase);
  if (!entitlement.ok) return entitlement.response;

  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();

  if (!tutorial) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: steps } = await supabase
    .from('mm_steps')
    .select('*')
    .eq('tutorial_id', id)
    .order('step_number', { ascending: true });

  if (!steps?.length) return NextResponse.json({ error: 'No steps' }, { status: 422 });

  const draftResult = await generateDraft(steps.map(step => {
    const evidence = step as typeof step & DraftStepEvidence;
    const target = evidence.action_info?.targetContext;
    return {
      ...step,
      screenshot_url: evidence.screenshot_url ?? null,
      action_type: evidence.action_info?.type ?? null,
      action_label: evidence.action_info?.label ?? null,
      element_text: evidence.element_text ?? target?.accessibleName ?? null,
      context_label: target?.contextLabel ?? null,
      page_title: target?.pageTitle ?? null,
      capture_surface: target?.captureSurface ?? null,
      capture_app: target?.captureApp ?? null,
    };
  }));
  const tutorialTitle = draftResult.tutorial_title.trim();
  if (draftResult.status !== 'ok' || !tutorialTitle || isLowQualityCaptureTutorialTitle(tutorialTitle, {
    stepTitles: steps.map(step => step.user_title || step.ai_title),
  })) {
    return NextResponse.json({ error: '신뢰할 수 있는 제목을 만들지 못했습니다. 기존 제목은 변경하지 않았습니다.' }, { status: 502 });
  }

  const { error } = await supabase
    .from('mm_tutorials')
    .update({ title: tutorialTitle })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ title: tutorialTitle, title_basis: draftResult.tutorial_title_basis });
}

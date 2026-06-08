import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, createServerClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ token: string }> };

// GET /api/guide/{share_token}  — published, 인증 불필요 (Extension용)
// GET /api/guide/{tutorial_id}  — draft 포함, 로그인한 소유자만 (본인 미리보기용)
export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  // UUID 형식이면 tutorial_id로 해석 → 소유자 인증 후 반환
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  if (isUuid) {
    // 로그인 세션 확인
    const serverClient = await createServerClient();
    const { data: { session } } = await serverClient.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tutorial } = await supabase
      .from('mm_tutorials')
      .select('id, title')
      .eq('id', token)
      .eq('user_id', session.user.id)
      .single();

    if (!tutorial) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(await fetchSteps(supabase, tutorial.id, tutorial.title));
  }

  // share_token으로 published 튜토리얼 조회 (공개)
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, title')
    .eq('share_token', token)
    .eq('status', 'published')
    .single();

  if (!tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(await fetchSteps(supabase, tutorial.id, tutorial.title));
}

async function fetchSteps(supabase: ReturnType<typeof createServiceRoleClient>, tutorialId: string, title: string) {
  const { data: rawSteps } = await supabase
    .from('mm_steps')
    .select(
      'id, step_number, user_title, ai_title, user_script, ai_description, ' +
      'page_url, element_selector, element_xpath, element_rect, click_x, click_y, screenshot_url'
    )
    .eq('tutorial_id', tutorialId)
    .order('step_number');

  const steps = ((rawSteps ?? []) as unknown as Record<string, unknown>[]).map(s => ({
    id: s.id,
    step_number: s.step_number,
    title: (s.user_title ?? s.ai_title ?? `Step ${s.step_number}`) as string,
    instruction: (s.user_script ?? s.ai_description ?? '') as string,
    page_url: s.page_url ?? null,
    element_selector: s.element_selector ?? null,
    element_xpath: s.element_xpath ?? null,
    element_rect: s.element_rect ?? null,
    click_x: s.click_x != null ? (s.click_x as number) / 10000 : null,
    click_y: s.click_y != null ? (s.click_y as number) / 10000 : null,
    screenshot_url: s.screenshot_url ?? null,
  }));

  return { tutorial_id: tutorialId, title, steps };
}

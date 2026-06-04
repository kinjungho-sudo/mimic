import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ token: string }> };

// Extension Guide Me — share_token으로 steps 조회 (published 전용)
// 인증: Bearer session_token (mm_extension_tokens) OR share_token으로 공개 접근
export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  // share_token으로 published 튜토리얼 조회
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, title, status')
    .eq('share_token', token)
    .eq('status', 'published')
    .single();

  if (!tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: rawSteps } = await supabase
    .from('mm_steps')
    .select(
      'id, step_number, user_title, ai_title, user_script, ai_description, ' +
      'page_url, element_selector, element_xpath, element_rect, click_x, click_y, screenshot_url'
    )
    .eq('tutorial_id', tutorial.id)
    .order('step_number');

  const steps = ((rawSteps ?? []) as unknown as Record<string, unknown>[]).map(s => ({
    id: s.id,
    step_number: s.step_number,
    title: s.user_title ?? s.ai_title ?? `Step ${s.step_number}`,
    instruction: s.user_script ?? s.ai_description ?? '',
    page_url: s.page_url ?? null,
    element_selector: s.element_selector ?? null,
    element_xpath: s.element_xpath ?? null,
    element_rect: s.element_rect ?? null,
    // DB 저장값 ×10000 → 0–1 비율로 변환
    click_x: s.click_x != null ? (s.click_x as number) / 10000 : null,
    click_y: s.click_y != null ? (s.click_y as number) / 10000 : null,
    screenshot_url: s.screenshot_url ?? null,
  }));

  return NextResponse.json({
    tutorial_id: tutorial.id,
    title: tutorial.title,
    steps,
  });
}

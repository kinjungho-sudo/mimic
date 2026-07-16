import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assessManualQuality, type ManualQualityStep } from '@/lib/manual-quality';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const guard = await guardTutorialAccess(id, auth.userId, 'editor');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const supabase = createServiceRoleClient();
  const [{ data: tutorial }, { data: steps, error }] = await Promise.all([
    supabase.from('mm_tutorials').select('title').eq('id', id).single(),
    supabase.from('mm_steps')
      .select('id, step_number, user_title, ai_title, user_script, ai_description, screenshot_url, click_x, click_y, element_rect, element_selector, element_xpath, follow_config, step_type, pii_detected')
      .eq('tutorial_id', id)
      .order('order_index')
      .order('step_number'),
  ]);

  if (!tutorial || error) return NextResponse.json({ error: '품질을 검사할 수 없습니다.' }, { status: 404 });
  const issues = assessManualQuality(tutorial.title, (steps ?? []) as ManualQualityStep[]);
  return NextResponse.json({
    ready: !issues.some(issue => issue.severity === 'error'),
    issues,
  });
}

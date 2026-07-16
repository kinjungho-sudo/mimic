import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { assessManualQuality, type ManualQualityStep } from '@/lib/manual-quality';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // 게시는 editor 이상 허용
  const guard = await guardTutorialAccess(id, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();

  // 기존 게시물도 재게시 시 우회하지 못하도록 서버에서 최종 품질 게이트를 적용한다.
  const [{ data: tutorialForQuality }, { data: stepsForQuality, error: qualityError }] = await Promise.all([
    supabase.from('mm_tutorials').select('title').eq('id', id).single(),
    supabase.from('mm_steps')
      .select('id, step_number, user_title, ai_title, user_script, ai_description, screenshot_url, click_x, click_y, element_rect, element_selector, element_xpath, follow_config, step_type, pii_detected')
      .eq('tutorial_id', id)
      .order('order_index')
      .order('step_number'),
  ]);
  if (!tutorialForQuality || qualityError) {
    return NextResponse.json({ error: '게시 전 품질 검사에 실패했습니다.' }, { status: 500 });
  }
  const qualityIssues = assessManualQuality(tutorialForQuality.title, (stepsForQuality ?? []) as ManualQualityStep[]);
  const blockingIssues = qualityIssues.filter(issue => issue.severity === 'error');
  if (blockingIssues.length > 0) {
    return NextResponse.json({
      error: '게시 전에 제목·설명·대상·개인정보 문제를 수정해주세요.',
      issues: qualityIssues,
    }, { status: 422 });
  }

  // 기존 share_token이 있으면 재사용 — 재게시 때마다 새 토큰을 발급하면 이미 공유된 링크가 죽음
  const { data: existing } = await supabase
    .from('mm_tutorials')
    .select('share_token')
    .eq('id', id)
    .single();

  const shareToken = existing?.share_token ?? randomBytes(16).toString('hex');

  const { data, error } = await supabase
    .from('mm_tutorials')
    .update({
      status: 'published',
      visibility: 'public',
      share_token: shareToken,
      published_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('share_token')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found or publish failed' }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json({
    share_token: data.share_token,
    share_url: `${appUrl}/play/${data.share_token}`,
  });
}

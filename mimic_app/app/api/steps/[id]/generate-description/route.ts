import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardStepAccess } from '@/lib/workspace-guard';
import { generateStepDescription } from '@/lib/claude';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  // 워크스페이스/공유 협업자도 editor 이상이면 AI 설명 생성 허용 (다른 스텝 라우트와 일관)
  const access = await guardStepAccess(id, auth.userId, 'editor');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const supabase = createServiceRoleClient();

  const { data: step } = await supabase
    .from('mm_steps')
    .select('id, ai_title, user_title, page_url, screenshot_url, tutorial_id')
    .eq('id', id)
    .single();

  if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const title = step.user_title || step.ai_title || '';

  // 스크린샷 fetch → base64 변환
  let screenshotBase64: string | undefined;
  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
  if (step.screenshot_url) {
    try {
      const imgRes = await fetch(step.screenshot_url);
      if (imgRes.ok) {
        const ct = imgRes.headers.get('content-type') ?? 'image/jpeg';
        mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const)
          .find(t => ct.includes(t)) ?? 'image/jpeg';
        const buf = await imgRes.arrayBuffer();
        screenshotBase64 = Buffer.from(buf).toString('base64');
      }
    } catch { /* 이미지 없어도 텍스트만으로 생성 */ }
  }

  const description = await generateStepDescription(title, step.page_url, screenshotBase64, mediaType);

  return NextResponse.json({ description });
}

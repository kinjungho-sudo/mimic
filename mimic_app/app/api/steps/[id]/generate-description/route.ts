import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateStepDescription } from '@/lib/claude';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // 소유권 확인 (step → tutorial → user)
  const { data: step } = await supabase
    .from('mm_steps')
    .select('id, ai_title, user_title, page_url, screenshot_url, tutorial_id')
    .eq('id', id)
    .single();

  if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id')
    .eq('id', step.tutorial_id)
    .eq('user_id', auth.userId)
    .single();

  if (!tutorial) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

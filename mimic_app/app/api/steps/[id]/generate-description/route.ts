import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardStepAccess } from '@/lib/auth/workspace-guard';
import { generateStepDescription, hasAnthropicApiKey } from '@/lib/ai/claude';
import { validateGeneratedManualScript } from '@/lib/ai/text-quality';
import { rateLimitAi } from '@/lib/rate-limit';
import { requireTutorialEntitlement } from '@/lib/auth/entitlement-guard';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimitAi(auth.userId);
  if (limited) return limited;

  if (!hasAnthropicApiKey()) {
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
    .select('id, ai_title, user_title, page_url, screenshot_url, tutorial_id')
    .eq('id', id)
    .single();

  if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const entitlement = await requireTutorialEntitlement(step.tutorial_id, 'ai_rewrite', supabase);
  if (!entitlement.ok) return entitlement.response;

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
  const quality = validateGeneratedManualScript(description);
  if (!quality.ok) {
    return NextResponse.json(
      { error: 'AI description was empty or low quality', reason: quality.reason },
      { status: 422 }
    );
  }

  // 생성 결과를 ai_description에 저장 — 재로드 시 빈 값으로 판정돼 매번 재생성되던 AI 비용·지연 낭비 차단
  const { error } = await supabase.from('mm_steps').update({ ai_description: quality.text }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to save generated description' }, { status: 500 });

  return NextResponse.json({ description: quality.text });
}

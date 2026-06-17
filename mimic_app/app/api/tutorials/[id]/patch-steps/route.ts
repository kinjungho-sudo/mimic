import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardTutorialAccess } from '@/lib/workspace-guard';
import { buildClickHighlight, buildClickPoint } from '@/lib/annotations';
import { analyzeScreenshot } from '@/lib/claude';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  // 워크스페이스/공유 협업자도 editor 이상이면 AI 보완 허용 (다른 스텝 라우트와 일관)
  const access = await guardTutorialAccess(id, auth.userId, 'editor');
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const supabase = createServiceRoleClient();

  // 보완 대상 스텝 조회
  const { data: steps } = await supabase
    .from('mm_steps')
    .select('id, step_number, ai_title, user_title, user_annotations, element_rect, click_x, click_y, screenshot_url, page_url')
    .eq('tutorial_id', id)
    .order('step_number', { ascending: true });

  if (!steps?.length) return NextResponse.json({ patched: 0 });

  // Promise.allSettled 내부에서 공유 변수를 직접 증가시키면 race condition 발생 —
  // 각 작업의 성공 여부를 결과로 돌려받아 집계
  const results = await Promise.allSettled(
    steps.map(async (step) => {
      const patch: Record<string, unknown> = {};

      // ── 어노테이션 보완 ──────────────────────────────────────
      const hasAnnotations = Array.isArray(step.user_annotations) && step.user_annotations.length > 0;
      if (!hasAnnotations) {
        const rect = step.element_rect as { x: number; y: number; width: number; height: number } | null;
        const label = step.user_title ?? step.ai_title ?? '클릭';
        const num = step.step_number ?? 1;

        if (rect) {
          patch.user_annotations = buildClickHighlight({ elementRect: rect, stepNumber: num, label });
        } else if (step.click_x != null && step.click_y != null) {
          // DB click_x/y: 0~1 정규화값 (Extension이 / viewportWidth로 저장)
          patch.user_annotations = buildClickPoint({
            clickX: step.click_x,
            clickY: step.click_y,
            stepNumber: num,
            label,
          });
        }
      }

      // ── 제목 보완 (user_title + ai_title 모두 없을 때) ──────
      const hasTitle = step.user_title || step.ai_title;
      if (!hasTitle && step.screenshot_url) {
        try {
          const imgRes = await fetch(step.screenshot_url);
          if (imgRes.ok) {
            const ct = imgRes.headers.get('content-type') ?? 'image/jpeg';
            const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const)
              .find(t => ct.includes(t)) ?? 'image/jpeg';
            const buf = await imgRes.arrayBuffer();
            const b64 = Buffer.from(buf).toString('base64');
            const { title } = await analyzeScreenshot(b64, mediaType, step.page_url);
            if (title) patch.ai_title = title;
          }
        } catch { /* 제목 생성 실패 무시 */ }
      }

      if (Object.keys(patch).length > 0) {
        await supabase.from('mm_steps').update(patch).eq('id', step.id);
        return true; // 보완됨
      }
      return false; // 보완 불필요
    })
  );

  const patched = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  return NextResponse.json({ patched });
}

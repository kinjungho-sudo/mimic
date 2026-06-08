import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assertStorageUrl } from '@/lib/validate-storage-url';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PptxGenJS = require('pptxgenjs');

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, title, user_id')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();

  if (!tutorial) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: steps } = await supabase
    .from('mm_steps')
    .select('step_number, screenshot_url, user_title, ai_title, user_script, ai_description')
    .eq('tutorial_id', id)
    .order('step_number');

  if (!steps?.length) return NextResponse.json({ error: 'No steps' }, { status: 422 });

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 16:9

  // 표지 슬라이드
  const cover = pptx.addSlide();
  cover.background = { color: '4F46E5' };
  cover.addText(tutorial.title, {
    x: 0.5, y: 2.2, w: '90%', h: 1.2,
    fontSize: 36, bold: true, color: 'FFFFFF',
    align: 'center', valign: 'middle',
    wrap: true,
  });
  cover.addText(`총 ${steps.length}단계`, {
    x: 0.5, y: 3.6, w: '90%', h: 0.5,
    fontSize: 18, color: 'C7D2FE', align: 'center',
  });

  // 스텝별 슬라이드
  for (const step of steps) {
    const slide = pptx.addSlide();
    slide.background = { color: 'F8F9FA' };

    // 상단 헤더 바
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.6,
      fill: { color: '111827' },
    });

    // 스텝 번호 + 제목
    const stepTitle = step.user_title ?? step.ai_title ?? `단계 ${step.step_number}`;
    slide.addText(`${step.step_number}. ${stepTitle}`, {
      x: 0.3, y: 0.08, w: '80%', h: 0.44,
      fontSize: 16, bold: true, color: 'FFFFFF',
      valign: 'middle',
    });

    // 스크린샷 (왼쪽)
    try {
      const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
      if (res.ok) {
        const imgBuf = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') ?? '';
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        slide.addImage({
          data: `data:image/${ext};base64,${imgBuf.toString('base64')}`,
          x: 0.3, y: 0.75, w: 6.0, h: 4.5,
        });
      }
    } catch {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.3, y: 0.75, w: 6.0, h: 4.5,
        fill: { color: 'E5E7EB' },
      });
      slide.addText('이미지 없음', {
        x: 0.3, y: 0.75, w: 6.0, h: 4.5,
        fontSize: 14, color: '9CA3AF', align: 'center', valign: 'middle',
      });
    }

    // 설명 텍스트 (오른쪽)
    const desc = step.user_script ?? step.ai_description ?? '';
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.7, y: 0.75, w: 3.0, h: 4.5,
      fill: { color: 'FFFFFF' },
      line: { color: 'E5E7EB', width: 1 },
    });
    slide.addText('설명', {
      x: 6.85, y: 0.9, w: 2.7, h: 0.3,
      fontSize: 11, bold: true, color: '4F46E5',
    });
    if (desc) {
      slide.addText(desc, {
        x: 6.85, y: 1.25, w: 2.7, h: 3.8,
        fontSize: 12, color: '374151',
        valign: 'top', wrap: true,
      });
    }

    // 하단 페이지 번호
    slide.addText(`${step.step_number} / ${steps.length}`, {
      x: 9.3, y: 5.3, w: 0.8, h: 0.3,
      fontSize: 10, color: '9CA3AF', align: 'right',
    });
  }

  const pptxBuffer: Buffer = await pptx.write({ outputType: 'nodebuffer' });
  const filename = encodeURIComponent(tutorial.title.replace(/[/\\?%*:|"<>]/g, '-'));

  return new Response(pptxBuffer.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${filename}.pptx"`,
    },
  });
}

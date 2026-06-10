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

  // LAYOUT_WIDE: 13.33" × 7.5"
  // 구도: 헤더(0.55") | 스크린샷 좌측(~8.8") | 설명 우측(~4.1") | 하단 페이지번호
  const W = 13.33;
  const H = 7.5;
  const HEADER_H = 0.55;
  const RIGHT_W = 4.13;
  const LEFT_W = W - RIGHT_W; // ~9.2"
  const BODY_Y = HEADER_H;
  const BODY_H = H - HEADER_H;
  const IMG_PAD = 0.22;

  for (const step of steps) {
    const slide = pptx.addSlide();
    slide.background = { color: '111827' };

    // 상단 헤더 바
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: W, h: HEADER_H,
      fill: { color: '1E2433' },
    });

    const stepTitle = step.user_title ?? step.ai_title ?? `단계 ${step.step_number}`;
    slide.addText(`${step.step_number}. ${stepTitle}`, {
      x: 0.3, y: 0, w: LEFT_W - 0.3, h: HEADER_H,
      fontSize: 17, bold: true, color: 'FFFFFF',
      valign: 'middle',
    });

    // 스크린샷 영역 배경
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: BODY_Y, w: LEFT_W, h: BODY_H,
      fill: { color: '1A1F2E' },
    });

    // 스크린샷 이미지 (상하좌우 패딩)
    const imgX = IMG_PAD;
    const imgY = BODY_Y + IMG_PAD;
    const imgW = LEFT_W - IMG_PAD * 2;
    const imgH = BODY_H - IMG_PAD * 2;

    try {
      const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
      if (res.ok) {
        const imgBuf = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') ?? '';
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        slide.addImage({
          data: `data:image/${ext};base64,${imgBuf.toString('base64')}`,
          x: imgX, y: imgY, w: imgW, h: imgH,
          sizing: { type: 'contain', w: imgW, h: imgH },
        });
      }
    } catch {
      slide.addText('이미지 없음', {
        x: imgX, y: imgY, w: imgW, h: imgH,
        fontSize: 14, color: '6B7280', align: 'center', valign: 'middle',
      });
    }

    // 오른쪽 설명 패널
    slide.addShape(pptx.ShapeType.rect, {
      x: LEFT_W, y: BODY_Y, w: RIGHT_W, h: BODY_H,
      fill: { color: 'F9FAFB' },
    });

    const desc = step.user_script ?? step.ai_description ?? '';
    const PAD = 0.25;
    slide.addText('설명', {
      x: LEFT_W + PAD, y: BODY_Y + PAD,
      w: RIGHT_W - PAD * 2, h: 0.35,
      fontSize: 13, bold: true, color: '4F46E5',
    });
    if (desc) {
      slide.addText(desc, {
        x: LEFT_W + PAD, y: BODY_Y + PAD + 0.4,
        w: RIGHT_W - PAD * 2, h: BODY_H - PAD * 2 - 0.4 - 0.4,
        fontSize: 13, color: '374151',
        valign: 'top', wrap: true,
        lineSpacingMultiple: 1.3,
      });
    }

    // 우하단 페이지 번호
    slide.addText(`${step.step_number} / ${steps.length}`, {
      x: LEFT_W + PAD, y: H - 0.38,
      w: RIGHT_W - PAD * 2, h: 0.3,
      fontSize: 11, color: '9CA3AF', align: 'right',
    });
  }

  const pptxBuffer: Buffer = await pptx.write({ outputType: 'nodebuffer' });
  const safeTitle = tutorial.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || '매뉴얼';
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '-').replace(/\.$/, '');
  const filenameRaw = `${safeTitle}_${dateStr}.pptx`;
  const filenameEncoded = encodeURIComponent(filenameRaw);

  return new Response(pptxBuffer.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${filenameEncoded}"; filename*=UTF-8''${filenameEncoded}`,
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { assertStorageUrl } from '@/lib/validate-storage-url';

type Params = { params: Promise<{ id: string }> };

// A4 landscape: 842 x 595 pt
const W = 842;
const H = 595;
const MARGIN = 40;
const IMG_W = 420;
const IMG_H = 315; // 4:3

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

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 표지 페이지
  const cover = pdfDoc.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.31, 0.27, 0.9) });
  cover.drawRectangle({ x: 0, y: 0, width: W, height: 6, color: rgb(0.49, 0.23, 0.93) });
  const titleText = tutorial.title;
  const titleSize = titleText.length > 30 ? 28 : 36;
  const titleWidth = fontBold.widthOfTextAtSize(titleText, titleSize);
  cover.drawText(titleText, {
    x: (W - Math.min(titleWidth, W - 80)) / 2,
    y: H / 2 + 20,
    size: titleSize,
    font: fontBold,
    color: rgb(1, 1, 1),
    maxWidth: W - 80,
  });
  cover.drawText(`총 ${steps.length}단계`, {
    x: W / 2 - 30,
    y: H / 2 - 30,
    size: 16,
    font,
    color: rgb(0.8, 0.8, 1),
  });

  // 스텝별 페이지
  for (const step of steps) {
    const page = pdfDoc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 44, width: W, height: 44, color: rgb(0.97, 0.97, 0.99) });
    page.drawLine({ start: { x: 0, y: H - 44 }, end: { x: W, y: H - 44 }, thickness: 1, color: rgb(0.9, 0.9, 0.92) });

    // 스텝 번호 배지
    page.drawCircle({ x: MARGIN + 12, y: H - 22, size: 12, color: rgb(0.31, 0.27, 0.9) });
    page.drawText(String(step.step_number), {
      x: step.step_number < 10 ? MARGIN + 8 : MARGIN + 5,
      y: H - 27,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // 제목
    const stepTitle = step.user_title ?? step.ai_title ?? `단계 ${step.step_number}`;
    page.drawText(stepTitle, {
      x: MARGIN + 32,
      y: H - 28,
      size: 14,
      font: fontBold,
      color: rgb(0.07, 0.09, 0.15),
      maxWidth: W - MARGIN * 2 - 32,
    });

    // 스크린샷
    const imgX = MARGIN;
    const imgY = H - 44 - IMG_H - 16;
    try {
      const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
      if (res.ok) {
        const imgBytes = await res.arrayBuffer();
        const contentType = res.headers.get('content-type') ?? '';
        const img = contentType.includes('png')
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes);
        const { width: iw, height: ih } = img.scale(1);
        const scale = Math.min(IMG_W / iw, IMG_H / ih);
        const drawW = iw * scale;
        const drawH = ih * scale;
        page.drawImage(img, {
          x: imgX + (IMG_W - drawW) / 2,
          y: imgY + (IMG_H - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      }
    } catch {
      // 이미지 로드 실패 시 회색 박스
      page.drawRectangle({ x: imgX, y: imgY, width: IMG_W, height: IMG_H, color: rgb(0.93, 0.93, 0.95) });
      page.drawText('이미지 없음', { x: imgX + IMG_W / 2 - 30, y: imgY + IMG_H / 2, size: 12, font, color: rgb(0.6, 0.6, 0.6) });
    }

    // 설명 텍스트 영역
    const textX = MARGIN + IMG_W + 24;
    const textW = W - textX - MARGIN;
    const desc = step.user_script ?? step.ai_description ?? '';

    page.drawText('설명', { x: textX, y: imgY + IMG_H - 4, size: 11, font: fontBold, color: rgb(0.31, 0.27, 0.9) });
    if (desc) {
      // 간단한 줄바꿈 처리
      const words = desc.split(' ');
      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, 12) > textW) {
          if (line) lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);

      lines.slice(0, 10).forEach((l, i) => {
        page.drawText(l, {
          x: textX,
          y: imgY + IMG_H - 22 - i * 18,
          size: 12,
          font,
          color: rgb(0.2, 0.2, 0.25),
          maxWidth: textW,
        });
      });
    }

    // 하단 페이지 번호
    page.drawText(`${step.step_number} / ${steps.length}`, {
      x: W - MARGIN - 40,
      y: 18,
      size: 10,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const filename = encodeURIComponent(tutorial.title.replace(/[/\\?%*:|"<>]/g, '-'));

  return new Response(pdfBytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    },
  });
}

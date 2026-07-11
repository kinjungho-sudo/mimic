import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';
import { assertStorageUrl } from '@/lib/validate-storage-url';
import { BRAND_NAME } from '@/lib/brand';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkit = require('@pdf-lib/fontkit');

type Params = { params: Promise<{ token: string }> };

const PW = 595, PH = 842, ML = 48, MR = 48, MT = 48, CONTENT_W = PW - ML - MR;

async function loadFont(filename: string): Promise<ArrayBuffer | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), 'public', 'fonts', filename));
    return buf.buffer as ArrayBuffer;
  } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text) {
    if (char === '\n') { lines.push(line); line = ''; continue; }
    const test = line + char;
    if (font.widthOfTextAtSize(test, size) > maxWidth) { if (line) lines.push(line); line = char; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, title')
    .eq('share_token', token)
    .eq('status', 'published')
    .single();

  if (!tutorial) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: steps } = await supabase
    .from('mm_steps')
    .select('step_number, screenshot_url, user_title, ai_title, user_script, ai_description')
    .eq('tutorial_id', tutorial.id)
    .order('step_number');

  if (!steps?.length) return NextResponse.json({ error: 'No steps' }, { status: 422 });

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([loadFont('NotoSansKR-Regular.ttf'), loadFont('NotoSansKR-Bold.ttf')]);
  const font = regularBytes ? await pdfDoc.embedFont(regularBytes) : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = boldBytes ? await pdfDoc.embedFont(boldBytes) : await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 표지
  const cover = pdfDoc.addPage([PW, PH]);
  cover.drawRectangle({ x: 0, y: PH * 0.6, width: PW, height: PH * 0.4, color: rgb(0.31, 0.27, 0.90) });
  cover.drawText(BRAND_NAME, { x: ML, y: PH - 48 - 28, size: 18, font: fontBold, color: rgb(1, 1, 1) });
  const titleLines = wrapText(tutorial.title, fontBold, 30, CONTENT_W);
  titleLines.slice(0, 3).forEach((l, i) => cover.drawText(l, { x: ML, y: PH * 0.7 - i * 38, size: 30, font: fontBold, color: rgb(1, 1, 1) }));
  cover.drawText(`${steps.length}단계 가이드`, { x: ML, y: PH * 0.7 - titleLines.slice(0, 3).length * 38 - 16, size: 14, font, color: rgb(0.8, 0.8, 1) });

  // 스텝 (웹 문서형과 동일한 카드 스타일)
  for (const step of steps) {
    const page = pdfDoc.addPage([PW, PH]);

    // 페이지 배경 — 라이트 그레이
    page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: rgb(0.973, 0.976, 0.980) });

    const cardX = ML, cardW = CONTENT_W, cardTop = PH - MT;
    const headerH = 52, headerY = cardTop - headerH;

    // 카드 테두리 + 흰 배경
    page.drawRectangle({ x: cardX - 0.5, y: 29.5, width: cardW + 1, height: cardTop - 29, color: rgb(0.898, 0.906, 0.918) });
    page.drawRectangle({ x: cardX, y: 30, width: cardW, height: cardTop - 30, color: rgb(1, 1, 1) });

    // 헤더 하단 구분선
    page.drawLine({ start: { x: cardX, y: headerY }, end: { x: cardX + cardW, y: headerY }, thickness: 0.5, color: rgb(0.957, 0.961, 0.965) });

    // 번호 배지 (사각형)
    const badgeSize = 28, badgeX = cardX + 16, badgeY = headerY + (headerH - badgeSize) / 2;
    page.drawRectangle({ x: badgeX, y: badgeY, width: badgeSize, height: badgeSize, color: rgb(0.216, 0.188, 0.639) });
    const numStr = String(step.step_number).padStart(2, '0');
    const numW = fontBold.widthOfTextAtSize(numStr, 11);
    page.drawText(numStr, { x: badgeX + (badgeSize - numW) / 2, y: badgeY + (badgeSize - 11) / 2 - 1, size: 11, font: fontBold, color: rgb(1, 1, 1) });

    // 스텝 제목
    const stepTitle = step.user_title ?? step.ai_title ?? `단계 ${step.step_number}`;
    const titleAvailW = cardW - badgeSize - 42;
    const stepTitleLines = wrapText(stepTitle, fontBold, 14, titleAvailW);
    stepTitleLines.slice(0, 2).forEach((l, i) => {
      const lineY = headerY + headerH / 2 + (stepTitleLines.length === 1 ? 0 : 8) - i * 17 - 3;
      page.drawText(l, { x: badgeX + badgeSize + 10, y: lineY, size: 14, font: fontBold, color: rgb(0.067, 0.090, 0.149) });
    });

    let cursorY = headerY - 16;

    // 스크린샷
    const maxImgH = 330, imgW = cardW;
    let imgBlockH = maxImgH;

    try {
      if (step.screenshot_url) {
        const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
        if (res.ok) {
          const imgBytes = await res.arrayBuffer();
          const ct = res.headers.get('content-type') ?? '';
          const img = ct.includes('png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
          const { width: iw, height: ih } = img.scale(1);
          const scale = Math.min(imgW / iw, maxImgH / ih);
          const drawW = iw * scale, drawH = ih * scale;
          imgBlockH = drawH;
          page.drawImage(img, { x: cardX + (imgW - drawW) / 2, y: cursorY - drawH, width: drawW, height: drawH });
        }
      } else {
        imgBlockH = 140;
        page.drawRectangle({ x: cardX, y: cursorY - imgBlockH, width: imgW, height: imgBlockH, color: rgb(0.949, 0.953, 0.961) });
        page.drawText('스크린샷 없음', { x: cardX + imgW / 2 - 36, y: cursorY - imgBlockH / 2 - 5, size: 11, font, color: rgb(0.612, 0.620, 0.647) });
      }
    } catch {
      imgBlockH = 140;
      page.drawRectangle({ x: cardX, y: cursorY - imgBlockH, width: imgW, height: imgBlockH, color: rgb(0.949, 0.953, 0.961) });
    }

    cursorY -= imgBlockH + 16;

    // 설명 텍스트
    const desc = step.user_script ?? step.ai_description ?? '';
    if (desc && cursorY > 60) {
      page.drawLine({ start: { x: cardX, y: cursorY }, end: { x: cardX + cardW, y: cursorY }, thickness: 0.5, color: rgb(0.957, 0.961, 0.965) });
      cursorY -= 14;
      const descLines = wrapText(desc, font, 11, cardW - 8);
      const lineH = 16, maxLines = Math.floor((cursorY - 50) / lineH);
      descLines.slice(0, maxLines).forEach((l, i) => page.drawText(l, { x: cardX + 4, y: cursorY - i * lineH, size: 11, font, color: rgb(0.20, 0.22, 0.28) }));
      if (descLines.length > maxLines) page.drawText('...', { x: cardX + 4, y: cursorY - maxLines * lineH, size: 11, font, color: rgb(0.55, 0.55, 0.60) });
    }

    // 페이지 번호
    const pnStr = `${step.step_number} / ${steps.length}`;
    page.drawText(pnStr, { x: (PW - font.widthOfTextAtSize(pnStr, 9)) / 2, y: 14, size: 9, font, color: rgb(0.65, 0.65, 0.68) });
  }

  const pdfBytes = await pdfDoc.save();
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '_').replace(/\.$/, '');
  const safeTitle = tutorial.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || '매뉴얼';
  const filenameRaw = `${dateStr}_${safeTitle}.pdf`;
  const filenameEncoded = encodeURIComponent(filenameRaw);
  return new Response(pdfBytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filenameEncoded}"; filename*=UTF-8''${filenameEncoded}`,
    },
  });
}

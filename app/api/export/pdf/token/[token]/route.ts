import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';
import { assertStorageUrl } from '@/lib/validate-storage-url';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkit = require('@pdf-lib/fontkit');

type Params = { params: Promise<{ token: string }> };

const PW = 595, PH = 842, ML = 48, MR = 48, CONTENT_W = PW - ML - MR;

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
  cover.drawText('MIMIC', { x: ML, y: PH - 48 - 28, size: 18, font: fontBold, color: rgb(1, 1, 1) });
  const titleLines = wrapText(tutorial.title, fontBold, 30, CONTENT_W);
  titleLines.slice(0, 3).forEach((l, i) => cover.drawText(l, { x: ML, y: PH * 0.7 - i * 38, size: 30, font: fontBold, color: rgb(1, 1, 1) }));
  cover.drawText(`${steps.length}단계 가이드`, { x: ML, y: PH * 0.7 - titleLines.slice(0, 3).length * 38 - 16, size: 14, font, color: rgb(0.8, 0.8, 1) });

  // 스텝
  for (const step of steps) {
    const page = pdfDoc.addPage([PW, PH]);
    let cursorY = PH - 48;

    page.drawRectangle({ x: 0, y: PH - 52, width: PW, height: 52, color: rgb(0.98, 0.98, 0.99) });
    page.drawLine({ start: { x: 0, y: PH - 52 }, end: { x: PW, y: PH - 52 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.92) });

    const badgeR = 13, badgeCX = ML + badgeR, badgeCY = PH - 26;
    page.drawCircle({ x: badgeCX, y: badgeCY, size: badgeR, color: rgb(0.31, 0.27, 0.90) });
    const numStr = String(step.step_number).padStart(2, '0');
    page.drawText(numStr, { x: badgeCX - fontBold.widthOfTextAtSize(numStr, 10) / 2, y: badgeCY - 4, size: 10, font: fontBold, color: rgb(1, 1, 1) });
    const stepTitle = step.user_title ?? step.ai_title ?? `단계 ${step.step_number}`;
    wrapText(stepTitle, fontBold, 13, CONTENT_W - badgeR * 2 - 16).slice(0, 2).forEach((l, i) =>
      page.drawText(l, { x: badgeCX + badgeR + 10, y: badgeCY + 4 - i * 16, size: 13, font: fontBold, color: rgb(0.07, 0.09, 0.15) }));

    cursorY = PH - 52 - 20;
    const maxImgH = 320, maxImgW = CONTENT_W;
    let imgBlockH = maxImgH;

    try {
      if (step.screenshot_url) {
        const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
        if (res.ok) {
          const imgBytes = await res.arrayBuffer();
          const ct = res.headers.get('content-type') ?? '';
          const img = ct.includes('png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
          const { width: iw, height: ih } = img.scale(1);
          const scale = Math.min(maxImgW / iw, maxImgH / ih);
          const drawW = iw * scale, drawH = ih * scale;
          imgBlockH = drawH;
          page.drawRectangle({ x: ML + (maxImgW - drawW) / 2 - 1, y: cursorY - drawH - 1, width: drawW + 2, height: drawH + 2, color: rgb(0.90, 0.90, 0.93) });
          page.drawImage(img, { x: ML + (maxImgW - drawW) / 2, y: cursorY - drawH, width: drawW, height: drawH });
        }
      } else {
        imgBlockH = 160;
        page.drawRectangle({ x: ML, y: cursorY - imgBlockH, width: maxImgW, height: imgBlockH, color: rgb(0.95, 0.95, 0.97) });
      }
    } catch { imgBlockH = 160; }

    cursorY -= imgBlockH + 20;
    const desc = step.user_script ?? step.ai_description ?? '';
    if (desc && cursorY > 80) {
      page.drawLine({ start: { x: ML, y: cursorY }, end: { x: PW - MR, y: cursorY }, thickness: 0.5, color: rgb(0.88, 0.88, 0.92) });
      cursorY -= 14;
      const descLines = wrapText(desc, font, 11, CONTENT_W);
      const lineH = 16, maxLines = Math.floor((cursorY - 40) / lineH);
      descLines.slice(0, maxLines).forEach((l, i) => page.drawText(l, { x: ML, y: cursorY - i * lineH, size: 11, font, color: rgb(0.20, 0.22, 0.28) }));
      if (descLines.length > maxLines) page.drawText('...', { x: ML, y: cursorY - maxLines * lineH, size: 11, font, color: rgb(0.55, 0.55, 0.60) });
    }

    const pnStr = `${step.step_number} / ${steps.length}`;
    page.drawText(pnStr, { x: (PW - font.widthOfTextAtSize(pnStr, 9)) / 2, y: 22, size: 9, font, color: rgb(0.65, 0.65, 0.68) });
  }

  const pdfBytes = await pdfDoc.save();
  const filename = encodeURIComponent(tutorial.title.replace(/[/\\?%*:|"<>]/g, '-'));
  return new Response(pdfBytes.buffer as ArrayBuffer, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}.pdf"` },
  });
}

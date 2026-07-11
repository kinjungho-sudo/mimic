import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';
import { assertStorageUrl } from '@/lib/validate-storage-url';
import { drawAnnotationsOnPdf } from '@/lib/export/annotate-pdf';
import type { ExportAnnotation } from '@/lib/export/annotations-shared';
import { renderStepImage } from '@/lib/export/render-step-image';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkit = require('@pdf-lib/fontkit');

type Params = { params: Promise<{ id: string }> };

const PW = 595;
const PH = 842;
const ML = 48;
const MT = 40;
const CONTENT_W = PW - ML * 2;

async function loadFont(filename: string): Promise<ArrayBuffer | null> {
  try {
    const p = path.join(process.cwd(), 'public', 'fonts', filename);
    const buf = await readFile(p);
    return buf.buffer as ArrayBuffer;
  } catch {
    return null;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '4F46E5';
  return {
    r: parseInt(normalized.slice(0, 2), 16) / 255,
    g: parseInt(normalized.slice(2, 4), 16) / 255,
    b: parseInt(normalized.slice(4, 6), 16) / 255,
  };
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of cleanText(text).split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else if (font.widthOfTextAtSize(test, size) > maxWidth) {
      let chunk = '';
      for (const char of word) {
        const charTest = chunk + char;
        if (font.widthOfTextAtSize(charTest, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = charTest;
        }
      }
      line = chunk;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function embedLogo(pdfDoc: PDFDocument, logoUrl: string | null | undefined): Promise<PDFImage | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(assertStorageUrl(logoUrl), { redirect: 'manual' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    const bytes = Buffer.from(await res.arrayBuffer());
    if (contentType.includes('png') || logoUrl.toLowerCase().includes('.png')) {
      return await pdfDoc.embedPng(bytes);
    }
    return await pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const access = await guardTutorialAccess(id, auth.userId, 'viewer');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, title, user_id')
    .eq('id', id)
    .single();

  if (!tutorial) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: steps } = await supabase
    .from('mm_steps')
    .select('step_number, screenshot_url, user_title, ai_title, user_script, ai_description, user_annotations, image_zoom, image_offset_x, image_offset_y')
    .eq('tutorial_id', id)
    .order('step_number');

  if (!steps?.length) return NextResponse.json({ error: 'No steps' }, { status: 422 });

  const [{ data: branding }, { data: owner }] = await Promise.all([
    supabase
      .from('mm_branding')
      .select('logo_url, primary_color, company_name')
      .eq('user_id', tutorial.user_id)
      .maybeSingle(),
    supabase
      .from('mm_users')
      .select('name')
      .eq('id', tutorial.user_id)
      .maybeSingle(),
  ]);

  const brand = hexToRgb(branding?.primary_color ?? '#4F46E5');
  const brandColor = rgb(brand.r, brand.g, brand.b);
  const companyName = cleanText(branding?.company_name) || 'Paaro';
  const ownerName = cleanText(owner?.name) || '-';
  const generatedAt = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul',
  });

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    loadFont('NotoSansKR-Regular.ttf'),
    loadFont('NotoSansKR-Bold.ttf'),
  ]);

  const font = regularBytes
    ? await pdfDoc.embedFont(regularBytes)
    : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = boldBytes
    ? await pdfDoc.embedFont(boldBytes)
    : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontFiles = regularBytes && boldBytes
    ? [
      path.join(process.cwd(), 'public', 'fonts', 'NotoSansKR-Regular.ttf'),
      path.join(process.cwd(), 'public', 'fonts', 'NotoSansKR-Bold.ttf'),
    ]
    : null;
  const logoImage = await embedLogo(pdfDoc, branding?.logo_url);

  const cover = pdfDoc.addPage([PW, PH]);
  cover.drawRectangle({ x: 0, y: PH * 0.58, width: PW, height: PH * 0.42, color: brandColor });
  if (logoImage) {
    const logoScale = Math.min(96 / logoImage.width, 30 / logoImage.height);
    const logoW = logoImage.width * logoScale;
    const logoH = logoImage.height * logoScale;
    cover.drawImage(logoImage, { x: ML, y: PH - MT - logoH, width: logoW, height: logoH });
  }
  cover.drawText(companyName, {
    x: ML,
    y: PH - MT - (logoImage ? 52 : 24),
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const titleLines = wrapText(tutorial.title, fontBold, 30, CONTENT_W).slice(0, 3);
  titleLines.forEach((line, i) => {
    cover.drawText(line, {
      x: ML,
      y: PH * 0.74 - i * 38,
      size: 30,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  });

  const metaY = PH * 0.74 - titleLines.length * 38 - 24;
  [
    `회사명  ${companyName}`,
    `작성일  ${generatedAt}`,
    `담당자  ${ownerName}`,
  ].forEach((line, i) => {
    cover.drawText(line, {
      x: ML,
      y: metaY - i * 22,
      size: 12,
      font,
      color: rgb(0.88, 0.89, 1),
    });
  });

  const summary = '실제 화면 흐름과 하이라이트를 따라 실행할 수 있는 업무 매뉴얼입니다.';
  wrapText(summary, font, 13, CONTENT_W).forEach((line, i) => {
    cover.drawText(line, {
      x: ML,
      y: PH * 0.49 - i * 20,
      size: 13,
      font,
      color: rgb(0.23, 0.25, 0.32),
    });
  });

  for (const step of steps) {
    const page = pdfDoc.addPage([PW, PH]);
    page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: rgb(0.973, 0.976, 0.980) });

    const cardX = 26;
    const cardW = PW - 52;
    const cardTop = PH - 26;
    const cardBottom = 24;
    const headerH = 52;
    const headerY = cardTop - headerH;

    page.drawRectangle({ x: cardX - 0.5, y: cardBottom - 0.5, width: cardW + 1, height: cardTop - cardBottom + 1, color: rgb(0.898, 0.906, 0.918) });
    page.drawRectangle({ x: cardX, y: cardBottom, width: cardW, height: cardTop - cardBottom, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x: cardX, y: headerY }, end: { x: cardX + cardW, y: headerY }, thickness: 0.5, color: rgb(0.957, 0.961, 0.965) });

    const badgeSize = 28;
    const badgeX = cardX + 16;
    const badgeY = headerY + (headerH - badgeSize) / 2;
    page.drawRectangle({ x: badgeX, y: badgeY, width: badgeSize, height: badgeSize, color: brandColor });
    const numStr = String(step.step_number).padStart(2, '0');
    const numW = fontBold.widthOfTextAtSize(numStr, 11);
    page.drawText(numStr, {
      x: badgeX + (badgeSize - numW) / 2,
      y: badgeY + 7,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    const stepTitle = cleanText(step.user_title ?? step.ai_title) || `단계 ${step.step_number}`;
    wrapText(stepTitle, fontBold, 14, cardW - badgeSize - 42).slice(0, 2).forEach((line, i, arr) => {
      page.drawText(line, {
        x: badgeX + badgeSize + 10,
        y: headerY + headerH / 2 + (arr.length === 1 ? 0 : 8) - i * 17 - 3,
        size: 14,
        font: fontBold,
        color: rgb(0.067, 0.090, 0.149),
      });
    });

    let cursorY = headerY - 12;
    const maxImgH = 460;
    const imgX = cardX;
    const imgW = cardW;
    let imgBlockH = maxImgH;

    try {
      if (step.screenshot_url) {
        const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
        if (res.ok) {
          const imgBytes = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get('content-type') ?? '';
          const annos = (step as { user_annotations?: unknown }).user_annotations as ExportAnnotation[] | null | undefined;
          const rendered = renderStepImage({
            imageBytes: imgBytes,
            contentType,
            annotations: annos,
            frame: step,
            fontFiles,
          });
          const img = rendered.type === 'png'
            ? await pdfDoc.embedPng(rendered.data)
            : await pdfDoc.embedJpg(rendered.data);
          const scale = Math.min(imgW / rendered.width, maxImgH / rendered.height);
          const drawW = rendered.width * scale;
          const drawH = rendered.height * scale;
          imgBlockH = drawH;
          const drawX = imgX + (imgW - drawW) / 2;
          const drawY = cursorY - drawH;
          page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
          if (rendered.data === imgBytes && annos?.length) {
            drawAnnotationsOnPdf(page, annos, { x: drawX, y: drawY, w: drawW, h: drawH }, font, fontBold);
          }
        }
      } else {
        imgBlockH = 140;
        page.drawRectangle({ x: imgX, y: cursorY - imgBlockH, width: imgW, height: imgBlockH, color: rgb(0.949, 0.953, 0.961) });
        page.drawText('스크린샷 없음', { x: imgX + 220, y: cursorY - imgBlockH / 2 - 5, size: 11, font, color: rgb(0.612, 0.620, 0.647) });
      }
    } catch {
      imgBlockH = 140;
      page.drawRectangle({ x: imgX, y: cursorY - imgBlockH, width: imgW, height: imgBlockH, color: rgb(0.949, 0.953, 0.961) });
    }

    cursorY -= imgBlockH + 14;

    const desc = cleanText(step.user_script ?? step.ai_description);
    if (desc && cursorY > 54) {
      wrapText(desc, font, 11, cardW - 10)
        .slice(0, Math.floor((cursorY - 44) / 16))
        .forEach((line, i) => {
          page.drawText(line, {
            x: cardX + 4,
            y: cursorY - i * 16,
            size: 11,
            font,
            color: rgb(0.20, 0.22, 0.28),
          });
        });
    }

    const pageNumStr = `${step.step_number} / ${steps.length}`;
    page.drawText(pageNumStr, {
      x: (PW - font.widthOfTextAtSize(pageNumStr, 9)) / 2,
      y: 12,
      size: 9,
      font,
      color: rgb(0.65, 0.65, 0.68),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '_').replace(/\.$/, '');
  const safeTitle = tutorial.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'manual';
  const filenameRaw = `${dateStr}_${safeTitle}.pdf`;
  const filenameEncoded = encodeURIComponent(filenameRaw);

  return new Response(pdfBytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filenameEncoded}"; filename*=UTF-8''${filenameEncoded}`,
    },
  });
}

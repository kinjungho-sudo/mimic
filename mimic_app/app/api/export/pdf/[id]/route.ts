import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';
import { assertStorageUrl } from '@/lib/validate-storage-url';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkit = require('@pdf-lib/fontkit');

type Params = { params: Promise<{ id: string }> };

// A4 세로: 595 x 842 pt
const PW = 595;
const PH = 842;
const ML = 48; // left margin
const MR = 48; // right margin
const MT = 48; // top margin
const CONTENT_W = PW - ML - MR;

async function loadFont(filename: string): Promise<ArrayBuffer | null> {
  try {
    const p = path.join(process.cwd(), 'public', 'fonts', filename);
    const buf = await readFile(p);
    return buf.buffer as ArrayBuffer;
  } catch {
    return null;
  }
}

/** 텍스트를 maxWidth 기준으로 줄 배열로 분리 */
function wrapText(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  font: any,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text) {
    if (char === '\n') { lines.push(line); line = ''; continue; }
    const test = line + char;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (line) lines.push(line);
      line = char;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

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
  pdfDoc.registerFontkit(fontkit);

  // 폰트: Noto Sans KR 우선, 실패 시 Helvetica fallback
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

  // ── 표지 페이지 ──────────────────────────────────────────
  const cover = pdfDoc.addPage([PW, PH]);

  // 배경: 상단 1/3 인디고 블록
  cover.drawRectangle({ x: 0, y: PH * 0.6, width: PW, height: PH * 0.4, color: rgb(0.31, 0.27, 0.90) });

  // MIMIC 브랜드
  cover.drawText('MIMIC', {
    x: ML,
    y: PH - MT - 28,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // 제목
  const titleLines = wrapText(tutorial.title, fontBold, 30, CONTENT_W);
  titleLines.slice(0, 3).forEach((l, i) => {
    cover.drawText(l, {
      x: ML,
      y: PH * 0.7 - i * 38,
      size: 30,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  });

  // 스텝 수
  cover.drawText(`${steps.length}단계 가이드`, {
    x: ML,
    y: PH * 0.7 - titleLines.slice(0, 3).length * 38 - 16,
    size: 14,
    font,
    color: rgb(0.8, 0.8, 1),
  });

  // 하단 구분선
  cover.drawLine({
    start: { x: ML, y: PH * 0.6 - 1 },
    end: { x: PW - MR, y: PH * 0.6 - 1 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.9),
  });

  // ── 스텝 페이지 (한 스텝 = 한 페이지, 웹 문서형과 동일한 카드 스타일) ──
  for (const step of steps) {
    const page = pdfDoc.addPage([PW, PH]);

    // 페이지 배경 — 라이트 그레이 (#F8F9FA)
    page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: rgb(0.973, 0.976, 0.980) });

    // 카드 여백 설정
    const cardX = ML;
    const cardW = CONTENT_W;
    const cardTop = PH - MT;

    // ── 카드 헤더 영역 ──
    const headerH = 52;
    const headerY = cardTop - headerH;

    // 헤더 흰 배경 (카드 전체 흰 배경을 먼저 깔고, 헤더 하단 구분선)
    // 카드 총 높이는 나중에 콘텐츠 크기에 따라 결정되므로 배경을 미리 넓게 깔기
    page.drawRectangle({ x: cardX, y: 30, width: cardW, height: cardTop - 30, color: rgb(1, 1, 1) });
    // 카드 테두리
    page.drawRectangle({ x: cardX - 0.5, y: 29.5, width: cardW + 1, height: cardTop - 29, color: rgb(0.898, 0.906, 0.918), opacity: 1 });
    page.drawRectangle({ x: cardX, y: 30, width: cardW, height: cardTop - 30, color: rgb(1, 1, 1) });

    // 헤더 하단 구분선
    page.drawLine({ start: { x: cardX, y: headerY }, end: { x: cardX + cardW, y: headerY }, thickness: 0.5, color: rgb(0.957, 0.961, 0.965) });

    // 스텝 번호 배지 (사각형)
    const badgeSize = 28;
    const badgeX = cardX + 16;
    const badgeY = headerY + (headerH - badgeSize) / 2;
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

    let cursorY = headerY - 16; // 헤더 아래 시작

    // ── 스크린샷 ──
    const maxImgH = 330;
    const imgX = cardX;
    const imgW = cardW;
    let imgBlockH = maxImgH;

    try {
      const screenshotUrl = step.screenshot_url;
      if (screenshotUrl) {
        const res = await fetch(assertStorageUrl(screenshotUrl), { redirect: 'manual' });
        if (res.ok) {
          const imgBytes = await res.arrayBuffer();
          const contentType = res.headers.get('content-type') ?? '';
          const img = contentType.includes('png')
            ? await pdfDoc.embedPng(imgBytes)
            : await pdfDoc.embedJpg(imgBytes);
          const { width: iw, height: ih } = img.scale(1);
          const scale = Math.min(imgW / iw, maxImgH / ih);
          const drawW = iw * scale;
          const drawH = ih * scale;
          imgBlockH = drawH;
          const drawX = imgX + (imgW - drawW) / 2;
          const drawY = cursorY - drawH;
          page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
        }
      } else {
        imgBlockH = 140;
        page.drawRectangle({ x: imgX, y: cursorY - imgBlockH, width: imgW, height: imgBlockH, color: rgb(0.949, 0.953, 0.961) });
        page.drawText('스크린샷 없음', { x: imgX + imgW / 2 - 36, y: cursorY - imgBlockH / 2 - 5, size: 11, font, color: rgb(0.612, 0.620, 0.647) });
      }
    } catch {
      imgBlockH = 140;
      page.drawRectangle({ x: imgX, y: cursorY - imgBlockH, width: imgW, height: imgBlockH, color: rgb(0.949, 0.953, 0.961) });
    }

    cursorY -= imgBlockH + 16;

    // ── 설명 텍스트 ──
    const desc = step.user_script ?? step.ai_description ?? '';
    if (desc && cursorY > 60) {
      page.drawLine({ start: { x: cardX, y: cursorY }, end: { x: cardX + cardW, y: cursorY }, thickness: 0.5, color: rgb(0.957, 0.961, 0.965) });
      cursorY -= 14;

      const descLines = wrapText(desc, font, 11, cardW - 8);
      const lineH = 16;
      const maxLines = Math.floor((cursorY - 50) / lineH);

      descLines.slice(0, maxLines).forEach((l, i) => {
        page.drawText(l, { x: cardX + 4, y: cursorY - i * lineH, size: 11, font, color: rgb(0.20, 0.22, 0.28) });
      });
      if (descLines.length > maxLines) {
        page.drawText('...', { x: cardX + 4, y: cursorY - maxLines * lineH, size: 11, font, color: rgb(0.55, 0.55, 0.60) });
      }
    }

    // ── 하단 페이지 번호 ──
    const pageNumStr = `${step.step_number} / ${steps.length}`;
    const pnW = font.widthOfTextAtSize(pageNumStr, 9);
    page.drawText(pageNumStr, { x: (PW - pnW) / 2, y: 14, size: 9, font, color: rgb(0.65, 0.65, 0.68) });
  }

  const pdfBytes = await pdfDoc.save();

  // 파일명: "매뉴얼 제목_2026-06-02.pdf" — RFC 5987 UTF-8 인코딩
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '-').replace(/\.$/, '');
  const safeTitle = tutorial.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || '매뉴얼';
  const filenameRaw = `${safeTitle}_${dateStr}.pdf`;
  const filenameEncoded = encodeURIComponent(filenameRaw);

  return new Response(pdfBytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      // filename*= (RFC 5987): 한글/특수문자 브라우저 완전 지원
      'Content-Disposition': `attachment; filename="${filenameEncoded}"; filename*=UTF-8''${filenameEncoded}`,
    },
  });
}

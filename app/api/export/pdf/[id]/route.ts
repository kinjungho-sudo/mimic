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

  // ── 스텝 페이지 (한 스텝 = 한 페이지) ───────────────────
  for (const step of steps) {
    const page = pdfDoc.addPage([PW, PH]);
    let cursorY = PH - MT; // 현재 Y 위치 (위→아래로 감소)

    // ── 헤더 바 ──
    page.drawRectangle({ x: 0, y: PH - 52, width: PW, height: 52, color: rgb(0.98, 0.98, 0.99) });
    page.drawLine({ start: { x: 0, y: PH - 52 }, end: { x: PW, y: PH - 52 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.92) });

    // 스텝 번호 배지
    const badgeR = 13;
    const badgeCX = ML + badgeR;
    const badgeCY = PH - 26;
    page.drawCircle({ x: badgeCX, y: badgeCY, size: badgeR, color: rgb(0.31, 0.27, 0.90) });
    const numStr = String(step.step_number).padStart(2, '0');
    const numW = fontBold.widthOfTextAtSize(numStr, 10);
    page.drawText(numStr, { x: badgeCX - numW / 2, y: badgeCY - 4, size: 10, font: fontBold, color: rgb(1, 1, 1) });

    // 스텝 제목
    const stepTitle = step.user_title ?? step.ai_title ?? `단계 ${step.step_number}`;
    const titleLines2 = wrapText(stepTitle, fontBold, 13, CONTENT_W - badgeR * 2 - 16);
    titleLines2.slice(0, 2).forEach((l, i) => {
      page.drawText(l, {
        x: badgeCX + badgeR + 10,
        y: badgeCY + 4 - i * 16,
        size: 13,
        font: fontBold,
        color: rgb(0.07, 0.09, 0.15),
      });
    });

    cursorY = PH - 52 - 20; // 헤더 아래

    // ── 스크린샷 ──
    const maxImgH = 320; // 이미지 최대 높이
    const maxImgW = CONTENT_W;
    let imgBlockH = maxImgH; // fallback 높이

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

          // 비율 유지하면서 maxImgW / maxImgH 안에 맞춤
          const scale = Math.min(maxImgW / iw, maxImgH / ih);
          const drawW = iw * scale;
          const drawH = ih * scale;
          imgBlockH = drawH;

          const imgX = ML + (maxImgW - drawW) / 2;
          const imgY = cursorY - drawH;

          // 이미지 외곽선 (연한 테두리)
          page.drawRectangle({ x: imgX - 1, y: imgY - 1, width: drawW + 2, height: drawH + 2, color: rgb(0.90, 0.90, 0.93) });
          page.drawImage(img, { x: imgX, y: imgY, width: drawW, height: drawH });
        }
      } else {
        // 스크린샷 없음 플레이스홀더
        imgBlockH = 160;
        page.drawRectangle({ x: ML, y: cursorY - imgBlockH, width: maxImgW, height: imgBlockH, color: rgb(0.95, 0.95, 0.97) });
        page.drawText('스크린샷 없음', {
          x: ML + maxImgW / 2 - 40,
          y: cursorY - imgBlockH / 2 - 5,
          size: 11,
          font,
          color: rgb(0.65, 0.65, 0.68),
        });
      }
    } catch {
      imgBlockH = 160;
      page.drawRectangle({ x: ML, y: cursorY - imgBlockH, width: maxImgW, height: imgBlockH, color: rgb(0.95, 0.95, 0.97) });
    }

    cursorY -= imgBlockH + 20;

    // ── 설명 텍스트 ──
    const desc = step.user_script ?? step.ai_description ?? '';
    if (desc && cursorY > 80) {
      // 구분선
      page.drawLine({
        start: { x: ML, y: cursorY },
        end: { x: PW - MR, y: cursorY },
        thickness: 0.5,
        color: rgb(0.88, 0.88, 0.92),
      });
      cursorY -= 14;

      const descLines = wrapText(desc, font, 11, CONTENT_W);
      const lineH = 16;
      const maxLines = Math.floor((cursorY - 40) / lineH);

      descLines.slice(0, maxLines).forEach((l, i) => {
        page.drawText(l, {
          x: ML,
          y: cursorY - i * lineH,
          size: 11,
          font,
          color: rgb(0.20, 0.22, 0.28),
        });
      });

      // 말줄임 표시
      if (descLines.length > maxLines) {
        page.drawText('...', {
          x: ML,
          y: cursorY - maxLines * lineH,
          size: 11,
          font,
          color: rgb(0.55, 0.55, 0.60),
        });
      }
    }

    // ── 하단 페이지 번호 ──
    const pageNumStr = `${step.step_number} / ${steps.length}`;
    const pnW = font.widthOfTextAtSize(pageNumStr, 9);
    page.drawText(pageNumStr, {
      x: (PW - pnW) / 2,
      y: 22,
      size: 9,
      font,
      color: rgb(0.65, 0.65, 0.68),
    });
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

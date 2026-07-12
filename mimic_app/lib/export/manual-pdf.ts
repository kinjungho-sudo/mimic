import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';
import { assertStorageUrl } from '@/lib/validate-storage-url';
import { drawAnnotationsOnPdf } from '@/lib/export/annotate-pdf';
import type { ExportAnnotation } from '@/lib/export/annotations-shared';
import { renderStepImage, type StepImageFrame } from '@/lib/export/render-step-image';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkit = require('@pdf-lib/fontkit');

type ManualPdfTutorial = {
  title: string;
};

export type ManualPdfStep = StepImageFrame & {
  step_number: number;
  screenshot_url?: string | null;
  user_title?: string | null;
  ai_title?: string | null;
  user_script?: string | null;
  ai_description?: string | null;
  user_annotations?: unknown;
};

const PW = 595;
const PH = 842;
const ML = 36;
const MR = 36;
const MT = 38;
const CONTENT_W = PW - ML - MR;

async function loadFont(filename: string): Promise<ArrayBuffer | null> {
  try {
    const file = await readFile(path.join(process.cwd(), 'public', 'fonts', filename));
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

function plainText(value?: string | null): string {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text) {
    const next = line + char;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function limitLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = `${visible[maxLines - 1].replace(/.{0,2}$/, '')}...`;
  return visible;
}

function fitContain(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
): { w: number; h: number } {
  const safeW = Math.max(1, naturalWidth);
  const safeH = Math.max(1, naturalHeight);
  const scale = Math.min(boxWidth / safeW, boxHeight / safeH);
  return { w: safeW * scale, h: safeH * scale };
}

export async function buildManualPdf(tutorial: ManualPdfTutorial, steps: ManualPdfStep[]): Promise<Uint8Array> {
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

  const cover = pdfDoc.addPage([PW, PH]);
  cover.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: rgb(0.973, 0.976, 0.980) });
  cover.drawRectangle({ x: 0, y: PH * 0.59, width: PW, height: PH * 0.41, color: rgb(0.31, 0.27, 0.90) });
  cover.drawText('MIMIC', { x: ML, y: PH - MT - 28, size: 18, font: fontBold, color: rgb(1, 1, 1) });

  const titleLines = wrapText(tutorial.title, fontBold, 30, CONTENT_W);
  titleLines.slice(0, 3).forEach((line, index) => {
    cover.drawText(line, {
      x: ML,
      y: PH * 0.72 - index * 38,
      size: 30,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  });
  cover.drawText(`${steps.length}단계 가이드`, {
    x: ML,
    y: PH * 0.72 - titleLines.slice(0, 3).length * 38 - 16,
    size: 14,
    font,
    color: rgb(0.86, 0.86, 1),
  });
  cover.drawText('화면 캡처와 설명을 웹 뷰어 순서로 정리한 실행 자료입니다.', {
    x: ML,
    y: PH * 0.49,
    size: 13,
    font,
    color: rgb(0.23, 0.25, 0.32),
  });
  const generatedAt = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  });
  cover.drawText(generatedAt, { x: ML, y: 64, size: 10, font, color: rgb(0.55, 0.58, 0.65) });

  for (const step of steps) {
    const page = pdfDoc.addPage([PW, PH]);
    page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: rgb(0.973, 0.976, 0.980) });

    const cardX = ML;
    const cardW = CONTENT_W;
    const cardTop = PH - MT;
    const minCardBottom = 54;
    const padX = 18;
    const padY = 16;
    const badgeSize = 26;
    const titleSize = 14;
    const descSize = 11;
    const titleLineH = titleSize * 1.45;
    const descLineH = descSize * 1.65;
    const stepTitle = plainText(step.user_title ?? step.ai_title) || `Step ${step.step_number}`;
    const desc = plainText(step.user_script ?? step.ai_description);
    const textX = cardX + padX + badgeSize + 10;
    const textW = cardW - padX * 2 - badgeSize - 10;
    const titleLinesForStep = wrapText(stepTitle, fontBold, titleSize, textW).slice(0, 2);
    const descLines = desc ? limitLines(wrapText(desc, font, descSize, textW), 4) : [];
    const headerTextH = titleLinesForStep.length * titleLineH + (descLines.length ? 4 + descLines.length * descLineH : 0);
    const headerH = padY * 2 + Math.max(badgeSize, headerTextH);
    const headerBottom = cardTop - headerH;
    const imageTop = headerBottom - 12;
    const imageMaxH = Math.max(140, imageTop - minCardBottom - 16);
    const annotations = (step as { user_annotations?: unknown }).user_annotations as ExportAnnotation[] | null | undefined;
    let image:
      | {
        data: Buffer;
        sourceData: Buffer;
        type: 'png' | 'jpg';
        x: number;
        y: number;
        w: number;
        h: number;
      }
      | null = null;
    let placeholder = false;

    try {
      if (step.screenshot_url) {
        const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
        if (res.ok) {
          const sourceData = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get('content-type') ?? '';
          const rendered = renderStepImage({
            imageBytes: sourceData,
            contentType,
            annotations,
            frame: step,
            fontFiles,
          });
          const fitted = fitContain(rendered.width, rendered.height, cardW, imageMaxH);
          image = {
            data: rendered.data,
            sourceData,
            type: rendered.type,
            x: cardX + (cardW - fitted.w) / 2,
            y: imageTop - fitted.h,
            w: fitted.w,
            h: fitted.h,
          };
        } else {
          placeholder = true;
        }
      } else {
        placeholder = true;
      }
    } catch {
      placeholder = true;
    }

    const imageBottom = image ? image.y : imageTop - 150;
    const cardBottom = Math.max(minCardBottom, imageBottom);
    page.drawRectangle({
      x: cardX - 0.5,
      y: cardBottom - 0.5,
      width: cardW + 1,
      height: cardTop - cardBottom + 1,
      color: rgb(0.898, 0.906, 0.918),
    });
    page.drawRectangle({ x: cardX, y: cardBottom, width: cardW, height: cardTop - cardBottom, color: rgb(1, 1, 1) });
    page.drawLine({
      start: { x: cardX, y: headerBottom },
      end: { x: cardX + cardW, y: headerBottom },
      thickness: 0.5,
      color: rgb(0.898, 0.906, 0.918),
    });

    const badgeX = cardX + padX;
    const badgeY = cardTop - padY - badgeSize;
    page.drawRectangle({ x: badgeX, y: badgeY, width: badgeSize, height: badgeSize, color: rgb(0.961, 0.620, 0.043) });
    const numStr = String(step.step_number).padStart(2, '0');
    const numW = fontBold.widthOfTextAtSize(numStr, 10);
    page.drawText(numStr, { x: badgeX + (badgeSize - numW) / 2, y: badgeY + 8, size: 10, font: fontBold, color: rgb(1, 1, 1) });

    let textY = cardTop - padY - titleSize;
    titleLinesForStep.forEach((line) => {
      page.drawText(line, { x: textX, y: textY, size: titleSize, font: fontBold, color: rgb(0.067, 0.090, 0.149) });
      textY -= titleLineH;
    });
    if (descLines.length) {
      textY -= 4;
      descLines.forEach((line) => {
        page.drawText(line, { x: textX, y: textY, size: descSize, font, color: rgb(0.294, 0.333, 0.388) });
        textY -= descLineH;
      });
    }

    if (image) {
      const embedded = image.type === 'png'
        ? await pdfDoc.embedPng(image.data)
        : await pdfDoc.embedJpg(image.data);
      page.drawRectangle({ x: cardX, y: image.y, width: cardW, height: image.h, color: rgb(0.953, 0.957, 0.965) });
      page.drawImage(embedded, { x: image.x, y: image.y, width: image.w, height: image.h });
      if (image.data === image.sourceData && annotations?.length) {
        drawAnnotationsOnPdf(page, annotations, { x: image.x, y: image.y, w: image.w, h: image.h }, font, fontBold);
      }
    } else if (placeholder) {
      const boxH = 150;
      page.drawRectangle({ x: cardX, y: imageTop - boxH, width: cardW, height: boxH, color: rgb(0.953, 0.957, 0.965) });
      page.drawText('이미지를 불러올 수 없습니다.', {
        x: cardX + cardW / 2 - 58,
        y: imageTop - boxH / 2 - 4,
        size: 11,
        font,
        color: rgb(0.612, 0.620, 0.647),
      });
    }

    const pageNumStr = `${step.step_number} / ${steps.length}`;
    const pageNumW = font.widthOfTextAtSize(pageNumStr, 9);
    page.drawText(pageNumStr, { x: (PW - pageNumW) / 2, y: 14, size: 9, font, color: rgb(0.65, 0.65, 0.68) });
  }

  return pdfDoc.save();
}

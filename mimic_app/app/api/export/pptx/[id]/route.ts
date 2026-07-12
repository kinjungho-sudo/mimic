import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assertStorageUrl } from '@/lib/validate-storage-url';
import type { ExportAnnotation } from '@/lib/export/annotations-shared';
import { renderStepImage } from '@/lib/export/render-step-image';
import { readFile } from 'fs/promises';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PptxGenJS = require('pptxgenjs');

type Params = { params: Promise<{ id: string }> };

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

function plainText(value?: string | null): string {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

  const { data: branding } = await supabase
    .from('mm_branding')
    .select('logo_url, primary_color, company_name, footer_text')
    .eq('user_id', auth.userId)
    .maybeSingle();

  const brandColor = (branding?.primary_color ?? '#4F46E5').replace('#', '').toUpperCase();
  const coverTextColor = isLightColor(brandColor) ? '111827' : 'FFFFFF';

  let logoData: string | null = null;
  if (branding?.logo_url) {
    try {
      const res = await fetch(assertStorageUrl(branding.logo_url), { redirect: 'manual' });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get('content-type') ?? '';
        logoData = `data:image/${ct.includes('png') ? 'png' : 'jpeg'};base64,${buf.toString('base64')}`;
      }
    } catch {
      logoData = null;
    }
  }

  const fontFiles = await (async (): Promise<string[] | null> => {
    try {
      const dir = path.join(process.cwd(), 'public', 'fonts');
      const files = [path.join(dir, 'NotoSansKR-Regular.ttf'), path.join(dir, 'NotoSansKR-Bold.ttf')];
      await Promise.all(files.map((file) => readFile(file)));
      return files;
    } catch {
      return null;
    }
  })();

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'MIMIC';
  pptx.subject = tutorial.title;
  pptx.title = tutorial.title;
  pptx.company = branding?.company_name ?? 'MIMIC';
  pptx.theme = {
    headFontFace: 'Malgun Gothic',
    bodyFontFace: 'Malgun Gothic',
    lang: 'ko-KR',
  };

  const cover = pptx.addSlide();
  cover.background = { color: brandColor };
  if (logoData) {
    cover.addImage({
      data: logoData,
      x: 0.5,
      y: 0.45,
      w: 2.2,
      h: 0.75,
      sizing: { type: 'contain', w: 2.2, h: 0.75 },
    });
  }
  cover.addText(tutorial.title, {
    x: 0.5,
    y: 2.25,
    w: '90%',
    h: 1.1,
    fontSize: 36,
    fontFace: 'Malgun Gothic',
    bold: true,
    color: coverTextColor,
    align: 'center',
    valign: 'middle',
    wrap: true,
    fit: 'shrink',
  });
  cover.addText(`총 ${steps.length}단계`, {
    x: 0.5,
    y: 3.55,
    w: '90%',
    h: 0.45,
    fontSize: 18,
    fontFace: 'Malgun Gothic',
    color: coverTextColor,
    transparency: 20,
    align: 'center',
  });
  if (branding?.company_name) {
    cover.addText(branding.company_name, {
      x: 0.5,
      y: 6.85,
      w: '90%',
      h: 0.4,
      fontSize: 13,
      fontFace: 'Malgun Gothic',
      color: coverTextColor,
      transparency: 25,
      align: 'center',
    });
  }

  const W = 13.33;
  const H = 7.5;
  const PAD = 0.28;
  const CAPTION_H = 0.82;

  for (const step of steps) {
    const slide = pptx.addSlide();
    slide.background = { color: '111827' };

    const stepTitle = plainText(step.user_title ?? step.ai_title) || `Step ${step.step_number}`;
    const desc = plainText(step.user_script ?? step.ai_description);
    const imgBoxX = 0;
    const imgBoxY = 0;
    const imgBoxW = W;
    const imgBoxH = H;

    if (step.screenshot_url) {
      try {
        const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
        if (res.ok) {
          const imgBuf = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get('content-type') ?? '';
          const annotations = (step as { user_annotations?: unknown }).user_annotations as ExportAnnotation[] | null | undefined;
          const rendered = renderStepImage({
            imageBytes: imgBuf,
            contentType,
            annotations,
            frame: step,
            fontFiles,
          });
          const fitted = fitContain(rendered.width, rendered.height, imgBoxW, imgBoxH);
          slide.addImage({
            data: `data:image/${rendered.type};base64,${rendered.data.toString('base64')}`,
            x: imgBoxX + (imgBoxW - fitted.w) / 2,
            y: imgBoxY + (imgBoxH - fitted.h) / 2,
            w: fitted.w,
            h: fitted.h,
          });
        }
      } catch {
        slide.addText('이미지를 불러올 수 없습니다.', {
          x: imgBoxX,
          y: imgBoxY,
          w: imgBoxW,
          h: imgBoxH,
          fontSize: 14,
          fontFace: 'Malgun Gothic',
          color: '9CA3AF',
          align: 'center',
          valign: 'middle',
        });
      }
    }

    slide.addShape(pptx.ShapeType.roundRect, {
      x: PAD,
      y: 0.16,
      w: 2.35,
      h: 0.34,
      fill: { color: '111827', transparency: 8 },
      line: { color: '111827', transparency: 100 },
    });
    slide.addText(`${String(step.step_number).padStart(2, '0')} / ${steps.length}`, {
      x: PAD + 0.14,
      y: 0.22,
      w: 0.58,
      h: 0.16,
      fontSize: 8,
      fontFace: 'Malgun Gothic',
      bold: true,
      color: brandColor,
      valign: 'middle',
      fit: 'shrink',
      margin: 0,
    });
    slide.addText(stepTitle, {
      x: PAD + 0.74,
      y: 0.19,
      w: 1.7,
      h: 0.22,
      fontSize: 8.5,
      fontFace: 'Malgun Gothic',
      bold: true,
      color: 'FFFFFF',
      valign: 'middle',
      fit: 'shrink',
      margin: 0,
    });

    if (desc) {
      const captionY = H - PAD - CAPTION_H;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: PAD,
        y: captionY,
        w: W - PAD * 2,
        h: CAPTION_H,
        fill: { color: '111827', transparency: 0 },
        line: { color: brandColor, transparency: 35, width: 1 },
      });
      slide.addText(desc, {
        x: PAD + 0.34,
        y: captionY + 0.12,
        w: W - PAD * 2 - 0.68,
        h: CAPTION_H - 0.18,
        fontSize: 13,
        fontFace: 'Malgun Gothic',
        color: 'FFFFFF',
        align: 'center',
        valign: 'middle',
        wrap: true,
        lineSpacingMultiple: 1.2,
        fit: 'shrink',
        margin: 0,
      });
    }
  }

  const pptxBuffer: Buffer = await pptx.write({ outputType: 'nodebuffer' });
  const safeTitle = tutorial.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || '매뉴얼';
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '_').replace(/\.$/, '');
  const filenameRaw = `${dateStr}_${safeTitle}.pptx`;
  const filenameAscii = filenameRaw.replace(/[^\x00-\x7F]/g, '_').replace(/_+/g, '_');
  const filenameEncoded = encodeURIComponent(filenameRaw);

  return new Response(new Uint8Array(pptxBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${filenameEncoded}`,
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assertStorageUrl } from '@/lib/validate-storage-url';
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from 'docx';
import { readFile } from 'fs/promises';
import path from 'path';
import type { ExportAnnotation } from '@/lib/export/annotations-shared';
import { renderStepImage } from '@/lib/export/render-step-image';
import { requireTutorialEntitlement } from '@/lib/auth/entitlement-guard';
import { BRAND_COLORS } from '@/lib/brand';

type Params = { params: Promise<{ id: string }> };
type DocxImage = { data: Buffer; type: 'png' | 'jpg'; width: number; height: number };

function imageSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = buf[off + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
      }
      off += 2 + buf.readUInt16BE(off + 2);
    }
  }
  return null;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hexColor(hex: string | null | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(hex ?? '') ? (hex as string).slice(1).toUpperCase() : BRAND_COLORS.primary.slice(1).toUpperCase();
}

async function fetchLogo(logoUrl: string | null | undefined): Promise<DocxImage | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(assertStorageUrl(logoUrl), { redirect: 'manual' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    const data = Buffer.from(await res.arrayBuffer());
    const type: 'png' | 'jpg' = contentType.includes('png') || logoUrl.toLowerCase().includes('.png') ? 'png' : 'jpg';
    const dim = imageSize(data);
    const width = 120;
    const height = dim && dim.w > 0 ? Math.min(46, Math.round(width * (dim.h / dim.w))) : 36;
    return { data, type, width, height };
  } catch {
    return null;
  }
}

function textParagraph(text: string, options: { size?: number; color?: string; bold?: boolean; after?: number; before?: number } = {}) {
  return new Paragraph({
    children: [new TextRun({
      text,
      size: options.size ?? 22,
      color: options.color ?? '374151',
      bold: options.bold,
      font: 'Malgun Gothic',
    })],
    alignment: AlignmentType.LEFT,
    spacing: { before: options.before ?? 0, after: options.after ?? 120 },
  });
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const access = await guardTutorialAccess(id, auth.userId, 'viewer');
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const entitlement = await requireTutorialEntitlement(id, 'office_export', supabase);
  if (!entitlement.ok) return entitlement.response;

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
      .select('logo_url, primary_color, company_name, footer_text')
      .eq('user_id', tutorial.user_id)
      .maybeSingle(),
    supabase
      .from('mm_users')
      .select('name')
      .eq('id', tutorial.user_id)
      .maybeSingle(),
  ]);

  const fontFiles = await (async (): Promise<string[] | null> => {
    try {
      const dir = path.join(process.cwd(), 'public', 'fonts');
      const files = [path.join(dir, 'NotoSansKR-Regular.ttf'), path.join(dir, 'NotoSansKR-Bold.ttf')];
      await Promise.all(files.map(file => readFile(file)));
      return files;
    } catch {
      return null;
    }
  })();

  const brandColor = hexColor(branding?.primary_color);
  const companyName = cleanText(branding?.company_name) || '회사명';
  const ownerName = cleanText(owner?.name) || '담당자명';
  const generatedAt = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  });
  const logo = await fetchLogo(branding?.logo_url);
  const MAX_W = 560;

  const children: Paragraph[] = [];

  if (logo) {
    children.push(new Paragraph({
      children: [new ImageRun({
        data: logo.data,
        type: logo.type,
        transformation: { width: logo.width, height: logo.height },
      })],
      alignment: AlignmentType.LEFT,
      spacing: { before: 320, after: 160 },
    }));
  }

  children.push(
    textParagraph(companyName, { size: 24, color: brandColor, bold: true, before: logo ? 0 : 320, after: 260 }),
    new Paragraph({
      text: tutorial.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 180 },
    }),
    textParagraph(`회사명 ${companyName}`, { size: 21, color: '4B5563', after: 80 }),
    textParagraph(`작성일 ${generatedAt}`, { size: 21, color: '4B5563', after: 80 }),
    textParagraph(`담당자 ${ownerName}`, { size: 21, color: '4B5563', after: 260 }),
    textParagraph('실제 화면 흐름과 하이라이트 주석을 따라 실행할 수 있는 업무 매뉴얼입니다.', { size: 22, color: '374151', after: 420 }),
  );

  for (const step of steps) {
    const stepTitle = cleanText(step.user_title ?? step.ai_title) || `단계 ${step.step_number}`;
    children.push(new Paragraph({
      children: [
        new TextRun({ text: String(step.step_number).padStart(2, '0'), bold: true, color: brandColor, size: 22, font: 'Malgun Gothic' }),
        new TextRun({ text: `  ${stepTitle}`, bold: true, color: '111827', size: 26, font: 'Malgun Gothic' }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { before: 260, after: 100 },
    }));

    try {
      if (step.screenshot_url) {
        const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get('content-type') ?? '';
          const annos = (step.user_annotations as ExportAnnotation[] | null) ?? null;
          const rendered = renderStepImage({
            imageBytes: buf,
            contentType,
            annotations: annos,
            frame: step,
            fontFiles,
          });
          const ratio = rendered.width > 0 ? rendered.height / rendered.width : 9 / 16;
          const h = Math.round(MAX_W * ratio);

          children.push(new Paragraph({
            children: [new ImageRun({
              data: rendered.data,
              type: rendered.type,
              transformation: { width: MAX_W, height: h },
            })],
            alignment: AlignmentType.LEFT,
            spacing: { after: 120 },
          }));
        }
      }
    } catch {
      // If image loading fails, keep the step text exportable.
    }

    const desc = cleanText(step.user_script ?? step.ai_description);
    if (desc) {
      children.push(textParagraph(desc, { size: 21, color: '374151', after: 180 }));
    }
  }

  const footerText = cleanText(branding?.footer_text) || companyName;
  if (footerText) {
    children.push(textParagraph(footerText, { size: 16, color: '9CA3AF', before: 260, after: 0 }));
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 540, bottom: 720, left: 540 } } },
      children,
    }],
  });
  const buffer = await Packer.toBuffer(doc);

  const safeTitle = tutorial.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'manual';
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '_').replace(/\.$/, '');
  const filenameRaw = `${dateStr}_${safeTitle}.docx`;
  const filenameAscii = filenameRaw.replace(/[^\x00-\x7F]/g, '_').replace(/_+/g, '_');
  const filenameEncoded = encodeURIComponent(filenameRaw);

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${filenameEncoded}`,
    },
  });
}

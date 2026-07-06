import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assertStorageUrl } from '@/lib/validate-storage-url';
import { AlignmentType, Document, ImageRun, Packer, Paragraph, TextRun } from 'docx';
import { readFile } from 'fs/promises';
import path from 'path';
import type { ExportAnnotation } from '@/lib/export/annotations-shared';
import { renderStepImage } from '@/lib/export/render-step-image';

type Params = { params: Promise<{ id: string }> };

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
  maxWidth: number,
  maxHeight: number,
): { w: number; h: number } {
  const safeW = Math.max(1, naturalWidth);
  const safeH = Math.max(1, naturalHeight);
  const scale = Math.min(maxWidth / safeW, maxHeight / safeH);
  return {
    w: Math.round(safeW * scale),
    h: Math.round(safeH * scale),
  };
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

  const { data: branding } = await supabase
    .from('mm_branding')
    .select('company_name, footer_text')
    .eq('user_id', auth.userId)
    .maybeSingle();

  const MAX_IMAGE_W = 640;
  const MAX_IMAGE_H = 440;
  const generatedAt = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  });

  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: branding?.company_name ?? 'MIMIC Manual', bold: true, color: '4F46E5', size: 24, font: 'Malgun Gothic' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 320, after: 220 },
    }),
    new Paragraph({
      children: [new TextRun({ text: tutorial.title, bold: true, color: '111827', size: 34, font: 'Malgun Gothic' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `총 ${steps.length}단계 · ${generatedAt}`, color: '6B7280', size: 20, font: 'Malgun Gothic' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 420 },
    }),
  ];

  for (const step of steps) {
    const stepTitle = plainText(step.user_title ?? step.ai_title) || `Step ${step.step_number}`;
    const desc = plainText(step.user_script ?? step.ai_description);

    children.push(new Paragraph({
      children: [
        new TextRun({ text: String(step.step_number).padStart(2, '0'), bold: true, color: 'F59E0B', size: 20, font: 'Malgun Gothic' }),
        new TextRun({ text: `  ${stepTitle}`, bold: true, color: '111827', size: 28, font: 'Malgun Gothic' }),
      ],
      spacing: { before: 260, after: desc ? 80 : 140 },
    }));

    if (desc) {
      children.push(new Paragraph({
        children: [new TextRun({ text: desc, size: 22, color: '4B5563', font: 'Malgun Gothic' })],
        spacing: { after: 140, line: 360 },
      }));
    }

    try {
      if (step.screenshot_url) {
        const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const ct = res.headers.get('content-type') ?? '';
          const annotations = (step as { user_annotations?: unknown }).user_annotations as ExportAnnotation[] | null | undefined;
          const rendered = renderStepImage({
            imageBytes: buf,
            contentType: ct,
            annotations,
            frame: step,
            fontFiles,
          });
          const fitted = fitContain(rendered.width, rendered.height, MAX_IMAGE_W, MAX_IMAGE_H);

          children.push(new Paragraph({
            children: [new ImageRun({
              data: rendered.data,
              type: rendered.type,
              transformation: { width: fitted.w, height: fitted.h },
            })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 260 },
          }));
        }
      }
    } catch {
      children.push(new Paragraph({
        children: [new TextRun({ text: '이미지를 불러올 수 없습니다.', size: 20, color: '9CA3AF', font: 'Malgun Gothic' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 260 },
      }));
    }
  }

  if (branding?.footer_text || branding?.company_name) {
    children.push(new Paragraph({
      children: [new TextRun({ text: branding.footer_text ?? branding.company_name ?? '', color: '9CA3AF', size: 16, font: 'Malgun Gothic' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 240 },
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 540, bottom: 720, left: 540 },
        },
      },
      children,
    }],
  });
  const buffer = await Packer.toBuffer(doc);

  const safeTitle = tutorial.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || '매뉴얼';
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

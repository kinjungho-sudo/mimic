import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assertStorageUrl } from '@/lib/validate-storage-url';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } from 'docx';

type Params = { params: Promise<{ id: string }> };

// PNG/JPEG 헤더에서 자연 크기 추출 (이미지 비율 유지용). 실패 시 null → 16:9 기본 적용.
function imageSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
      }
      off += 2 + buf.readUInt16BE(off + 2);
    }
  }
  return null;
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

  const { data: branding } = await supabase
    .from('mm_branding')
    .select('company_name, footer_text')
    .eq('user_id', auth.userId)
    .maybeSingle();

  const MAX_W = 560; // 본문 폭(px)에 맞춘 이미지 최대 너비

  const children: Paragraph[] = [
    new Paragraph({ text: tutorial.title, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [new TextRun({ text: `총 ${steps.length}단계`, color: '6B7280', size: 22 })],
      spacing: { after: 240 },
    }),
  ];

  for (const step of steps) {
    const stepTitle = step.user_title ?? step.ai_title ?? `단계 ${step.step_number}`;
    children.push(new Paragraph({
      text: `${step.step_number}. ${stepTitle}`,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 80 },
    }));

    const desc = step.user_script ?? step.ai_description ?? '';
    if (desc) {
      children.push(new Paragraph({
        children: [new TextRun({ text: desc.replace(/<[^>]+>/g, '').trim(), size: 22, color: '374151' })],
        spacing: { after: 120 },
      }));
    }

    try {
      const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get('content-type') ?? '';
        const isPng = ct.includes('png');
        const dim = imageSize(buf);
        const ratio = dim && dim.w > 0 ? dim.h / dim.w : 9 / 16;
        const w = MAX_W;
        const h = Math.round(MAX_W * ratio);
        children.push(new Paragraph({
          children: [new ImageRun({
            data: buf,
            type: isPng ? 'png' : 'jpg',
            transformation: { width: w, height: h },
          })],
          spacing: { after: 200 },
        }));
      }
    } catch { /* 이미지 로드 실패 시 해당 스텝은 텍스트만 출력 */ }
  }

  if (branding?.footer_text || branding?.company_name) {
    children.push(new Paragraph({
      children: [new TextRun({ text: branding.footer_text ?? branding.company_name ?? '', color: '9CA3AF', size: 16 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 240 },
    }));
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);

  const safeTitle = tutorial.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || '매뉴얼';
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '_').replace(/\.$/, '');
  const filenameRaw = `${safeTitle}_${dateStr}.docx`;
  const filenameAscii = filenameRaw.replace(/[^\x00-\x7F]/g, '_').replace(/_+/g, '_');
  const filenameEncoded = encodeURIComponent(filenameRaw);

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${filenameEncoded}`,
    },
  });
}

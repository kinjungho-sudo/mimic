import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assertStorageUrl } from '@/lib/validate-storage-url';
import { drawAnnotationsOnPptx } from '@/lib/export/annotate-pptx';
import { getImageDims, type ExportAnnotation } from '@/lib/export/annotations-shared';
import { isPaidPlan } from '@/lib/plan';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PptxGenJS = require('pptxgenjs');

type Params = { params: Promise<{ id: string }> };
type PptxImage = { dataUri: string; width: number; height: number };
type SlideLike = {
  background?: { color: string };
  addText: (text: string, options: Record<string, unknown>) => void;
  addShape: (shapeType: string, options: Record<string, unknown>) => void;
  addImage: (options: Record<string, unknown>) => void;
};
type PptxLike = {
  ShapeType: Record<string, string>;
  layout: string;
  author: string;
  subject: string;
  title: string;
  addSlide: () => SlideLike;
  write: (options: { outputType: 'nodebuffer' }) => Promise<Buffer>;
};

const W = 13.33;
const NAVY = '151B2B';
const BRAND_TEAL = '19B7B0';
const WHITE = 'FFFFFF';

function clickToPct(v: number | null | undefined): number | null {
  if (v == null) return null;
  if (v <= 1) return v * 100;
  if (v > 100) return v / 100;
  return v;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPptxImage(url: string | null | undefined): Promise<PptxImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(assertStorageUrl(url), { redirect: 'manual' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    const ext = contentType.includes('png') || url.toLowerCase().includes('.png') ? 'png' : 'jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    const dim = getImageDims(buf);
    return {
      dataUri: `data:image/${ext};base64,${buf.toString('base64')}`,
      width: dim?.w ?? 16,
      height: dim?.h ?? 9,
    };
  } catch {
    return null;
  }
}

function containRect(source: { width: number; height: number }, target: { x: number; y: number; w: number; h: number }) {
  const scale = Math.min(target.w / source.width, target.h / source.height);
  const w = source.width * scale;
  const h = source.height * scale;
  return {
    x: target.x + (target.w - w) / 2,
    y: target.y + (target.h - h) / 2,
    w,
    h,
  };
}

function addParroWatermark(slide: SlideLike) {
  slide.addText('Parro', {
    x: W - 1.25,
    y: 0.22,
    w: 0.9,
    h: 0.22,
    fontSize: 13,
    bold: true,
    color: BRAND_TEAL,
    align: 'right',
    margin: 0,
  });
}

function addCoverSlide(pptx: PptxLike, options: {
  title: string;
  companyName: string;
  ownerName: string;
  generatedAt: string;
  customerLogo: PptxImage | null;
  showParro: boolean;
}) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: W,
    h: 4,
    fill: { color: NAVY },
    line: { color: NAVY, transparency: 100 },
  });

  if (options.showParro) addParroWatermark(slide);

  slide.addText(options.title, {
    x: 2.25,
    y: 1.75,
    w: 8.85,
    h: 0.68,
    fontSize: 36,
    bold: true,
    color: WHITE,
    align: 'center',
    margin: 0,
    fit: 'shrink',
  });
  slide.addText('(화면 캡처 · 하이라이트 주석 · 실행 설명)', {
    x: 2.2,
    y: 2.7,
    w: 8.95,
    h: 0.36,
    fontSize: 21,
    bold: true,
    color: WHITE,
    align: 'center',
    margin: 0,
  });
  slide.addText(`[${options.companyName}]`, {
    x: 5.45,
    y: 4.3,
    w: 2.5,
    h: 0.28,
    fontSize: 16,
    color: '374151',
    align: 'center',
    margin: 0,
  });
  slide.addText(options.generatedAt, {
    x: 5.45,
    y: 4.85,
    w: 2.5,
    h: 0.28,
    fontSize: 15,
    color: '374151',
    align: 'center',
    margin: 0,
  });
  slide.addText(options.ownerName, {
    x: 10.1,
    y: 6.15,
    w: 2.75,
    h: 0.36,
    fontSize: 18,
    color: '374151',
    align: 'right',
    margin: 0,
  });

  if (options.customerLogo) {
    const r = containRect(options.customerLogo, { x: 0.3, y: 6.78, w: 1.35, h: 0.42 });
    slide.addImage({ data: options.customerLogo.dataUri, ...r });
  } else {
    slide.addText(options.companyName, {
      x: 0.3,
      y: 6.82,
      w: 1.7,
      h: 0.28,
      fontSize: 14,
      bold: true,
      color: '374151',
      margin: 0,
      fit: 'shrink',
    });
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
    .select('id, step_number, screenshot_url, user_title, ai_title, user_script, ai_description, user_annotations, click_x, click_y')
    .eq('tutorial_id', id)
    .order('order_index')
    .order('step_number');

  if (!steps?.length) return NextResponse.json({ error: 'No steps' }, { status: 422 });

  const [{ data: markers }, { data: branding }, { data: owner }] = await Promise.all([
    supabase
      .from('mm_markers')
      .select('step_id, position_x, position_y, marker_number')
      .in('step_id', steps.map(s => s.id)),
    supabase
      .from('mm_branding')
      .select('logo_url, company_name')
      .eq('user_id', tutorial.user_id)
      .maybeSingle(),
    supabase
      .from('mm_users')
      .select('name, plan')
      .eq('id', tutorial.user_id)
      .maybeSingle(),
  ]);

  const companyName = cleanText(branding?.company_name) || '회사명';
  const ownerName = cleanText(owner?.name) || '담당자명';
  const showParroWatermark = !isPaidPlan(owner?.plan);
  const customerLogo = await fetchPptxImage(branding?.logo_url);
  const generatedAt = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '. ').replace(/\.$/, '');

  const markersByStepId = new Map<string, NonNullable<typeof markers>>();
  for (const marker of markers ?? []) {
    const existing = markersByStepId.get(marker.step_id) ?? [];
    existing.push(marker);
    markersByStepId.set(marker.step_id, existing);
  }

  const pptx = new PptxGenJS() as PptxLike;
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Parro';
  pptx.subject = tutorial.title;
  pptx.title = tutorial.title;

  addCoverSlide(pptx, {
    title: tutorial.title,
    companyName,
    ownerName,
    generatedAt,
    customerLogo,
    showParro: showParroWatermark,
  });

  const FRAME_W = 10.6;
  const FRAME_H = 6.05;
  const FRAME_X = (W - FRAME_W) / 2;
  const FRAME_Y = 0.66;

  for (let idx = 0; idx < steps.length; idx += 1) {
    const step = steps[idx];
    const slide = pptx.addSlide();
    slide.background = { color: NAVY };
    if (showParroWatermark) addParroWatermark(slide);

    const stepTitle = cleanText(step.user_title ?? step.ai_title) || `단계 ${step.step_number}`;
    slide.addText(`${idx + 1}. ${stepTitle}`, {
      x: 0.25,
      y: 0.17,
      w: 7.6,
      h: 0.36,
      fontSize: 18,
      bold: true,
      color: WHITE,
      margin: 0,
      fit: 'shrink',
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x: FRAME_X,
      y: FRAME_Y,
      w: FRAME_W,
      h: FRAME_H,
      rectRadius: 0.18,
      fill: { color: '0E1118' },
      line: { color: NAVY, transparency: 100 },
    });

    let drawRect = { x: FRAME_X, y: FRAME_Y, w: FRAME_W, h: FRAME_H };
    try {
      const screenshot = await fetchPptxImage(step.screenshot_url);
      if (screenshot) {
        drawRect = containRect(screenshot, { x: FRAME_X, y: FRAME_Y, w: FRAME_W, h: FRAME_H });
        slide.addImage({ data: screenshot.dataUri, ...drawRect });

        drawAnnotationsOnPptx(
          pptx,
          slide,
          (step as { user_annotations?: unknown }).user_annotations as ExportAnnotation[] | null | undefined,
          drawRect,
        );
      } else {
        slide.addText('스크린샷 없음', {
          x: FRAME_X,
          y: FRAME_Y,
          w: FRAME_W,
          h: FRAME_H,
          fontSize: 14,
          color: '9CA3AF',
          align: 'center',
          valign: 'middle',
        });
      }
    } catch {
      slide.addText('스크린샷 없음', {
        x: FRAME_X,
        y: FRAME_Y,
        w: FRAME_W,
        h: FRAME_H,
        fontSize: 14,
        color: '9CA3AF',
        align: 'center',
        valign: 'middle',
      });
    }

    const clickXPct = clickToPct(step.click_x);
    const clickYPct = clickToPct(step.click_y);
    if (clickXPct != null && clickYPct != null && idx < steps.length - 1) {
      const cx = drawRect.x + (clickXPct / 100) * drawRect.w;
      const cy = drawRect.y + (clickYPct / 100) * drawRect.h;
      slide.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.32,
        y: cy - 0.32,
        w: 0.64,
        h: 0.64,
        line: { color: WHITE, transparency: 25, width: 1.2 },
        fill: { color: WHITE, transparency: 100 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.18,
        y: cy - 0.18,
        w: 0.36,
        h: 0.36,
        line: { color: 'A5B4FC', transparency: 20, width: 1 },
        fill: { color: WHITE, transparency: 100 },
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.05,
        y: cy - 0.05,
        w: 0.1,
        h: 0.1,
        fill: { color: WHITE },
        line: { color: WHITE, transparency: 100 },
      });
    }

    const stepMarkers = (markersByStepId.get(step.id) ?? [])
      .sort((a, b) => (a.marker_number ?? 0) - (b.marker_number ?? 0));
    stepMarkers.forEach((marker, markerIdx) => {
      const cx = drawRect.x + ((marker.position_x ?? 0) * drawRect.w);
      const cy = drawRect.y + ((marker.position_y ?? 0) * drawRect.h);
      const color = markerIdx === stepMarkers.length - 1 ? BRAND_TEAL : 'DC2626';
      slide.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.15,
        y: cy - 0.15,
        w: 0.3,
        h: 0.3,
        fill: { color },
        line: { color, transparency: 100 },
      });
      slide.addText(String(marker.marker_number ?? markerIdx + 1), {
        x: cx - 0.15,
        y: cy - 0.15,
        w: 0.3,
        h: 0.3,
        fontSize: 8,
        bold: true,
        color: WHITE,
        align: 'center',
        valign: 'middle',
        margin: 0,
      });
    });

    const desc = cleanText(step.user_script ?? step.ai_description);
    if (desc) {
      slide.addText(desc, {
        x: 2.6,
        y: 7.05,
        w: 8.1,
        h: 0.28,
        fontSize: 14,
        color: WHITE,
        align: 'center',
        margin: 0,
        fit: 'shrink',
      });
    }
  }

  const pptxBuffer: Buffer = await pptx.write({ outputType: 'nodebuffer' });
  const safeTitle = tutorial.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'manual';
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '_').replace(/\.$/, '');
  const filenameRaw = `${dateStr}_${safeTitle}.pptx`;
  const filenameAscii = filenameRaw.replace(/[^\x00-\x7F]/g, '_').replace(/_+/g, '_');
  const filenameEncoded = encodeURIComponent(filenameRaw);

  return new Response(pptxBuffer.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${filenameEncoded}`,
    },
  });
}

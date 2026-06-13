import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assertStorageUrl } from '@/lib/validate-storage-url';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PptxGenJS = require('pptxgenjs');

type Params = { params: Promise<{ id: string }> };

/** 밝은 색이면 true — 표지 텍스트를 어두운 색으로 전환할 때 사용 */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
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

  // 브랜딩 설정 (없으면 기본값)
  const { data: branding } = await supabase
    .from('mm_branding')
    .select('logo_url, primary_color, company_name, footer_text')
    .eq('user_id', auth.userId)
    .maybeSingle();

  const brandColor = (branding?.primary_color ?? '#4F46E5').replace('#', '').toUpperCase();
  const coverTextColor = isLightColor(brandColor) ? '111827' : 'FFFFFF';

  // 로고 이미지 미리 받아두기 (표지에 사용)
  let logoData: string | null = null;
  if (branding?.logo_url) {
    try {
      const res = await fetch(assertStorageUrl(branding.logo_url), { redirect: 'manual' });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get('content-type') ?? '';
        logoData = `data:image/${ct.includes('png') ? 'png' : 'jpeg'};base64,${buf.toString('base64')}`;
      }
    } catch { /* 로고 로드 실패 시 로고 없이 출력 */ }
  }

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 16:9

  // 표지 슬라이드
  const cover = pptx.addSlide();
  cover.background = { color: brandColor };
  if (logoData) {
    cover.addImage({
      data: logoData,
      x: 0.5, y: 0.45, w: 2.2, h: 0.75,
      sizing: { type: 'contain', w: 2.2, h: 0.75 },
    });
  }
  cover.addText(tutorial.title, {
    x: 0.5, y: 2.2, w: '90%', h: 1.2,
    fontSize: 36, bold: true, color: coverTextColor,
    align: 'center', valign: 'middle',
    wrap: true,
  });
  cover.addText(`총 ${steps.length}단계`, {
    x: 0.5, y: 3.6, w: '90%', h: 0.5,
    fontSize: 18, color: coverTextColor, transparency: 25, align: 'center',
  });
  if (branding?.company_name) {
    cover.addText(branding.company_name, {
      x: 0.5, y: 6.85, w: '90%', h: 0.4,
      fontSize: 13, color: coverTextColor, transparency: 25, align: 'center',
    });
  }

  // LAYOUT_WIDE: 13.33" × 7.5"
  // 구도: 헤더(0.55") | 스크린샷 전체 폭 | 하단 캡션 띠(1.25") — 이미지와 겹치지 않음
  const W = 13.33;
  const H = 7.5;
  const HEADER_H = 0.55;
  const CAPTION_H = 1.25;
  const BODY_Y = HEADER_H;
  const BODY_H = H - HEADER_H - CAPTION_H;
  const IMG_PAD = 0.22;

  for (const step of steps) {
    const slide = pptx.addSlide();
    slide.background = { color: '111827' };

    // 상단 헤더 바
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: W, h: HEADER_H,
      fill: { color: '1E2433' },
    });

    const stepTitle = step.user_title ?? step.ai_title ?? `단계 ${step.step_number}`;
    slide.addText(`${step.step_number}. ${stepTitle}`, {
      x: 0.3, y: 0, w: W - 1.5, h: HEADER_H,
      fontSize: 17, bold: true, color: 'FFFFFF',
      valign: 'middle',
    });

    // 우상단 페이지 번호
    slide.addText(`${step.step_number} / ${steps.length}`, {
      x: W - 1.2, y: 0, w: 0.95, h: HEADER_H,
      fontSize: 11, color: '9CA3AF', align: 'right', valign: 'middle',
    });

    // 스크린샷 영역 배경 (전체 폭)
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: BODY_Y, w: W, h: BODY_H,
      fill: { color: '1A1F2E' },
    });

    // 스크린샷 이미지 (상하좌우 패딩)
    const imgX = IMG_PAD;
    const imgY = BODY_Y + IMG_PAD;
    const imgW = W - IMG_PAD * 2;
    const imgH = BODY_H - IMG_PAD * 2;

    try {
      const res = await fetch(assertStorageUrl(step.screenshot_url), { redirect: 'manual' });
      if (res.ok) {
        const imgBuf = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') ?? '';
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        slide.addImage({
          data: `data:image/${ext};base64,${imgBuf.toString('base64')}`,
          x: imgX, y: imgY, w: imgW, h: imgH,
          sizing: { type: 'contain', w: imgW, h: imgH },
        });
      }
    } catch {
      slide.addText('이미지 없음', {
        x: imgX, y: imgY, w: imgW, h: imgH,
        fontSize: 14, color: '6B7280', align: 'center', valign: 'middle',
      });
    }

    // 하단 캡션 띠 (상단에 브랜드 컬러 라인)
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: H - CAPTION_H, w: W, h: CAPTION_H,
      fill: { color: 'F9FAFB' },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: H - CAPTION_H, w: W, h: 0.04,
      fill: { color: brandColor },
    });

    const desc = step.user_script ?? step.ai_description ?? '';
    if (desc) {
      slide.addText(desc, {
        x: 0.6, y: H - CAPTION_H, w: W - 1.2, h: CAPTION_H,
        fontSize: 14, color: '374151',
        align: 'center', valign: 'middle', wrap: true,
        lineSpacingMultiple: 1.2,
        fit: 'shrink',
      });
    }

    // 푸터 문구 (브랜딩 설정 시)
    if (branding?.footer_text) {
      slide.addText(branding.footer_text, {
        x: 0.15, y: H - 0.32, w: 5, h: 0.28,
        fontSize: 8.5, color: '9CA3AF', valign: 'middle',
      });
    }
  }

  const pptxBuffer: Buffer = await pptx.write({ outputType: 'nodebuffer' });
  const safeTitle = tutorial.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || '매뉴얼';
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '_').replace(/\.$/, '');
  const filenameRaw = `${safeTitle}_${dateStr}.pptx`;
  const filenameAscii = filenameRaw.replace(/[^\x00-\x7F]/g, '_').replace(/_+/g, '_');
  const filenameEncoded = encodeURIComponent(filenameRaw);

  return new Response(pptxBuffer.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${filenameEncoded}`,
    },
  });
}

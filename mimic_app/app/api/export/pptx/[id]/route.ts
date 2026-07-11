import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { assertStorageUrl } from '@/lib/validate-storage-url';
import type { ExportAnnotation } from '@/lib/export/annotations-shared';
import { renderStepImage } from '@/lib/export/render-step-image';
import { BRAND_COLORS } from '@/lib/brand';
import { readFile } from 'fs/promises';
import path from 'path';
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

  // 소유자뿐 아니라 워크스페이스 멤버·이메일 공유 협업자(viewer 이상)도 내보내기 허용
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

  // 브랜딩 설정 (없으면 기본값)
  const { data: branding } = await supabase
    .from('mm_branding')
    .select('logo_url, primary_color, company_name, footer_text')
    .eq('user_id', auth.userId)
    .maybeSingle();

  const brandColor = (branding?.primary_color ?? BRAND_COLORS.primary).replace('#', '').toUpperCase();
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
  const fontFiles = await (async (): Promise<string[] | null> => {
    try {
      const dir = path.join(process.cwd(), 'public', 'fonts');
      const files = [path.join(dir, 'NotoSansKR-Regular.ttf'), path.join(dir, 'NotoSansKR-Bold.ttf')];
      await Promise.all(files.map(f => readFile(f)));
      return files;
    } catch { return null; }
  })();

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
  cover.addShape(pptx.ShapeType.roundRect, {
    x: 3.05, y: 4.45, w: 7.25, h: 0.95,
    fill: { color: isLightColor(brandColor) ? 'FFFFFF' : '111827', transparency: 12 },
    line: { color: coverTextColor, transparency: 75, width: 1 },
  });
  cover.addText('화면 캡처 · 하이라이트 주석 · 실행 설명', {
    x: 3.25, y: 4.63, w: 6.85, h: 0.35,
    fontSize: 14, bold: true, color: coverTextColor,
    align: 'center', valign: 'middle',
  });
  cover.addText('실제 업무 흐름을 따라 볼 수 있는 매뉴얼 자료', {
    x: 3.25, y: 4.98, w: 6.85, h: 0.25,
    fontSize: 10.5, color: coverTextColor, transparency: 22,
    align: 'center', valign: 'middle',
  });
  if (branding?.company_name) {
    cover.addText(branding.company_name, {
      x: 0.5, y: 6.85, w: '90%', h: 0.4,
      fontSize: 13, color: coverTextColor, transparency: 25, align: 'center',
    });
  }

  // LAYOUT_WIDE: 13.33" × 7.5"
  // 구도: 헤더 아래 전체를 스크린샷으로 쓰고 설명은 웹 뷰어처럼 이미지 위에 오버레이한다.
  const W = 13.33;
  const H = 7.5;
  const HEADER_H = 0.55;
  const BODY_Y = HEADER_H;
  const BODY_H = H - HEADER_H;
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
        const annos = (step as { user_annotations?: unknown }).user_annotations as ExportAnnotation[] | null | undefined;
        const rendered = renderStepImage({
          imageBytes: imgBuf,
          contentType,
          annotations: annos,
          frame: step,
          fontFiles,
        });
        slide.addImage({
          data: `data:image/${rendered.type};base64,${rendered.data.toString('base64')}`,
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

    const desc = (step.user_script ?? step.ai_description ?? '')
      .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
    if (desc) {
      const overlayH = 0.9;
      const overlayY = H - overlayH - 0.28;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.45, y: overlayY, w: W - 0.9, h: overlayH,
        fill: { color: '111827', transparency: 15 },
        line: { color: brandColor, transparency: 15, width: 1 },
      });
      slide.addText(desc, {
        x: 0.75, y: overlayY + 0.1, w: W - 1.5, h: overlayH - 0.2,
        fontSize: 14, color: 'FFFFFF',
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

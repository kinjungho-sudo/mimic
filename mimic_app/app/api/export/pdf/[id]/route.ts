import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { buildManualPdf, type ManualPdfStep } from '@/lib/export/manual-pdf';

type Params = { params: Promise<{ id: string }> };

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

  const [{ data: branding }, { data: owner }] = await Promise.all([
    supabase
      .from('mm_branding')
      .select('logo_url, primary_color, company_name')
      .eq('user_id', tutorial.user_id)
      .maybeSingle(),
    supabase
      .from('mm_users')
      .select('name')
      .eq('id', tutorial.user_id)
      .maybeSingle(),
  ]);

  const pdfBytes = await buildManualPdf({
    title: tutorial.title,
    companyName: branding?.company_name ?? null,
    ownerName: owner?.name ?? null,
    logoUrl: branding?.logo_url ?? null,
    primaryColor: branding?.primary_color ?? null,
  }, steps as ManualPdfStep[]);
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '_').replace(/\.$/, '');
  const safeTitle = tutorial.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'manual';
  const filenameRaw = `${dateStr}_${safeTitle}.pdf`;
  const filenameAscii = filenameRaw.replace(/[^\x00-\x7F]/g, '_').replace(/_+/g, '_');
  const filenameEncoded = encodeURIComponent(filenameRaw);
  const body = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${filenameEncoded}`,
    },
  });
}

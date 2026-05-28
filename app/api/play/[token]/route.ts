import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: tutorial, error } = await supabase
    .from('mm_tutorials')
    .select('*')
    .eq('share_token', token)
    .eq('status', 'published')
    .single();

  if (error || !tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: rawSteps } = await supabase
    .from('mm_steps')
    .select('*')
    .eq('tutorial_id', tutorial.id)
    .order('order_index');

  const steps = rawSteps ?? [];
  const stepIds = steps.map(s => s.id);

  const [markersRes, audioRes, annotationsRes] = await Promise.all([
    supabase.from('mm_markers').select('*').in('step_id', stepIds),
    supabase.from('mm_audio_assets').select('*').in('step_id', stepIds),
    supabase.from('mm_annotations').select('*').in('step_id', stepIds),
  ]);

  // 플레이어가 기대하는 shape으로 정규화
  const normalizedSteps = steps.map((s, idx) => ({
    id: s.id,
    title: s.user_title ?? s.ai_title ?? `단계 ${idx + 1}`,
    caption: s.user_script ?? s.ai_description ?? '',
    screenshot_url: s.screenshot_url ?? null,
    order_index: s.order_index,
  }));

  const normalizedMarkers = (markersRes.data ?? []).map(m => ({
    id: m.id,
    step_id: m.step_id,
    x_pct: m.position_x * 100,
    y_pct: m.position_y * 100,
    label: String(m.marker_number),
    order_index: m.marker_number,
  }));

  const normalizedAnnotations = (annotationsRes.data ?? []).map((a, idx) => ({
    id: a.id,
    step_id: a.step_id,
    title: (a.style as Record<string, string>)?.label ?? `항목 ${idx + 1}`,
    body: (a.style as Record<string, string>)?.text ?? '',
    marker_index: idx,
  }));

  return NextResponse.json({
    id: tutorial.id,
    title: tutorial.title,
    steps: normalizedSteps,
    markers: normalizedMarkers,
    annotations: normalizedAnnotations,
    audio_assets: audioRes.data ?? [],
  });
}

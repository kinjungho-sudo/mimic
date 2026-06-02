import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ token: string }> };

async function fetchTutorialData(token: string) {
  const supabase = createServiceRoleClient();

  const { data: tutorial, error } = await supabase
    .from('mm_tutorials')
    .select('*')
    .eq('share_token', token)
    .eq('status', 'published')
    .single();

  if (error || !tutorial) return null;

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

  const normalizedSteps = steps.map((s, idx) => ({
    id: s.id,
    title: s.user_title ?? s.ai_title ?? `단계 ${idx + 1}`,
    caption: s.user_script ?? s.ai_description ?? '',
    screenshot_url: s.screenshot_url ?? null,
    order_index: s.order_index,
    page_url: s.page_url ?? null,
    element_selector: (s as Record<string, unknown>).element_selector ?? null,
    element_xpath: (s as Record<string, unknown>).element_xpath ?? null,
    crop_rect: (s as Record<string, unknown>).crop_rect ?? null,
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

  return {
    tutorial,
    payload: {
      id: tutorial.id,
      title: tutorial.title,
      steps: normalizedSteps,
      markers: normalizedMarkers,
      annotations: normalizedAnnotations,
      audio_assets: audioRes.data ?? [],
    },
  };
}

// GET — 비밀번호 설정 시 { protected: true, title } 반환, 없으면 전체 데이터
export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  const result = await fetchTutorialData(token);

  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (result.tutorial.share_password) {
    return NextResponse.json({ protected: true, title: result.tutorial.title });
  }

  return NextResponse.json(result.payload);
}

// POST — { password } 검증 후 전체 데이터 반환
export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  const { password } = body as { password?: string };

  const result = await fetchTutorialData(token);
  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (result.tutorial.share_password) {
    if (!password || password !== result.tutorial.share_password) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
    }
  }

  return NextResponse.json(result.payload);
}

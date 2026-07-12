import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/auth/password';
import { isPaidPlan } from '@/lib/plan';
import { isFreshVoiceAsset } from '@/lib/voice/playback';

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

  const { data: owner } = await supabase
    .from('mm_users')
    .select('plan')
    .eq('id', tutorial.user_id)
    .single();
  const ownerPlan = owner?.plan ?? 'free';
  const voiceEnabled = isPaidPlan(ownerPlan) && tutorial.tts_enabled;

  const { data: rawSteps } = await supabase
    .from('mm_steps')
    .select('*')
    .eq('tutorial_id', tutorial.id)
    .order('order_index')
    .order('step_number');

  const steps = rawSteps ?? [];
  const stepIds = steps.map(s => s.id);

  const [markersRes, audioRes, annotationsRes] = await Promise.all([
    supabase.from('mm_markers').select('*').in('step_id', stepIds),
    supabase.from('mm_audio_assets').select('*').in('step_id', stepIds),
    supabase.from('mm_annotations').select('*').in('step_id', stepIds),
  ]);

  const freshAudioAssets = voiceEnabled
    ? (audioRes.data ?? []).filter(asset => {
        const step = steps.find(s => s.id === asset.step_id);
        return isFreshVoiceAsset(step, asset);
      })
    : [];

  const normalizedSteps = steps.map((s, idx) => ({
    id: s.id,
    title: s.user_title || s.ai_title || `단계 ${idx + 1}`,
    caption: s.user_script || s.ai_description || '',
    voice_audio_url: voiceEnabled ? ((s as Record<string, unknown>).voice_audio_url as string | null ?? null) : null,
    voice_audio_start_ms: voiceEnabled ? ((s as Record<string, unknown>).voice_audio_start_ms as number | null ?? null) : null,
    voice_audio_end_ms: voiceEnabled ? ((s as Record<string, unknown>).voice_audio_end_ms as number | null ?? null) : null,
    screenshot_url: s.screenshot_url ?? null,
    order_index: s.order_index,
    page_url: s.page_url ?? null,
    element_selector: (s as Record<string, unknown>).element_selector ?? null,
    element_xpath: (s as Record<string, unknown>).element_xpath ?? null,
    step_type: (s as Record<string, unknown>).step_type ?? null,
    capture_source: (s as Record<string, unknown>).capture_source ?? null,
    capture_failure_reason: (s as Record<string, unknown>).capture_failure_reason ?? null,
    crop_rect: (s as Record<string, unknown>).crop_rect ?? null,
    click_x: (s as Record<string, unknown>).click_x as number | null ?? null,
    click_y: (s as Record<string, unknown>).click_y as number | null ?? null,
    follow_config: (s as Record<string, unknown>).follow_config ?? null,
    type_text: (s as Record<string, unknown>).type_text as string | null ?? null,
    image_zoom: (s as Record<string, unknown>).image_zoom as number | null ?? null,
    image_offset_x: (s as Record<string, unknown>).image_offset_x as number | null ?? null,
    image_offset_y: (s as Record<string, unknown>).image_offset_y as number | null ?? null,
    // 편집기에서 그린 도형/텍스트 어노테이션
    user_annotations: (s.user_annotations as unknown[] | null) ?? [],
    // DOM 요소 bounding rect (0~100 pct) — 실습하기 직사각형 하이라이트·줌인에 사용
    element_rect: (() => {
      const raw = (s as Record<string, unknown>).element_rect as { x?: number; y?: number; width?: number; height?: number } | null;
      if (!raw || raw.x == null) return null;
      return { x: (raw.x ?? 0) * 100, y: (raw.y ?? 0) * 100, w: (raw.width ?? 0) * 100, h: (raw.height ?? 0) * 100 };
    })(),
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
      tts_enabled: voiceEnabled,
      survey_enabled: !isPaidPlan(ownerPlan),
      steps: normalizedSteps,
      markers: normalizedMarkers,
      annotations: normalizedAnnotations,
      audio_assets: freshAudioAssets,
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
    const ok = password ? await verifyPassword(password, result.tutorial.share_password) : false;
    if (!ok) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
    }
  }

  return NextResponse.json(result.payload);
}

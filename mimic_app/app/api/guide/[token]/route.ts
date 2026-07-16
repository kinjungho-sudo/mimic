import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, createServerClient } from '@/lib/supabase/server';
import { isPaidPlan } from '@/lib/plan';
import { resolveStepAudio } from '@/lib/voice/playback';
import { getBrandAppUrl } from '@/lib/brand';
import { maskManualCopy } from '@/lib/manual-quality';

type Params = { params: Promise<{ token: string }> };

// 라이브 가이드 유료 게이팅 — 제작자(소유자) 과금. Free 소유자는 누적 5회 무료 후 페이월.
const FREE_LIVE_GUIDE_LIMIT = 5;
const PAID_PLANS = ['pro', 'team', 'enterprise'];

function isMissingExceptionStepColumns(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === '42703'
    || /step_type|capture_source|capture_failure_reason/i.test(error?.message ?? '');
}
const APP_URL = getBrandAppUrl();

// 소유자 플랜·사용량으로 게이트 판정. 반환: 막혔으면 gated 정보, 아니면 null.
// charge=true(공개 실행)일 때만 카운트 차감 — RPC로 원자적 check-and-increment(race 방지).
// charge=false(소유자 미리보기)는 읽기 전용 판정만 — 미리보기로 무료 한도가 소진되지 않게.
async function gateLiveGuide(
  supabase: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  charge: boolean,
): Promise<{ gated: true; limit: number; used: number; upgradeUrl: string } | null> {
  const { data: owner } = await supabase
    .from('mm_users')
    .select('plan, live_guide_runs')
    .eq('id', ownerId)
    .single();

  const plan = owner?.plan ?? 'free';
  if (PAID_PLANS.includes(plan)) return null; // 유료=무제한(미카운트)

  const gated = { gated: true as const, limit: FREE_LIVE_GUIDE_LIMIT, used: owner?.live_guide_runs ?? 0, upgradeUrl: `${APP_URL}/landingpage#pricing` };

  if (!charge) {
    // 미리보기 — 차감 없이 한도만 확인
    return gated.used >= FREE_LIVE_GUIDE_LIMIT ? gated : null;
  }

  // 공개 실행 — 한도 미만일 때만 원자적으로 1회 차감. 한도 도달 시 RPC가 NULL 반환.
  const { data: newCount } = await supabase.rpc('consume_free_live_guide_run', {
    uid: ownerId,
    free_limit: FREE_LIVE_GUIDE_LIMIT,
  });
  return newCount == null ? gated : null;
}

// GET /api/guide/{share_token}  — published, 인증 불필요 (Extension용)
// GET /api/guide/{tutorial_id}  — draft 포함, 로그인한 소유자만 (본인 미리보기용)
export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  // UUID 형식이면 tutorial_id로 해석 → 소유자 인증 후 반환
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  if (isUuid) {
    // 로그인 세션 확인
    const serverClient = await createServerClient();
    const { data: { session } } = await serverClient.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tutorial } = await supabase
      .from('mm_tutorials')
      .select('id, title, user_id, tts_enabled')
      .eq('id', token)
      .eq('user_id', session.user.id)
      .single();

    if (!tutorial) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 소유자 미리보기 — 차감 없이 한도만 확인
    const gated = await gateLiveGuide(supabase, tutorial.user_id, false);
    if (gated) return NextResponse.json(gated);

    return NextResponse.json(await fetchSteps(supabase, tutorial.id, tutorial.title, tutorial.user_id, !!tutorial.tts_enabled));
  }

  // share_token으로 published 튜토리얼 조회 (공개)
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, title, user_id, tts_enabled')
    .eq('share_token', token)
    .eq('status', 'published')
    .single();

  if (!tutorial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 공개 실행 — 원자적 차감
  const gated = await gateLiveGuide(supabase, tutorial.user_id, true);
  if (gated) return NextResponse.json(gated);

  return NextResponse.json(await fetchSteps(supabase, tutorial.id, tutorial.title, tutorial.user_id, !!tutorial.tts_enabled));
}

async function fetchSteps(supabase: ReturnType<typeof createServiceRoleClient>, tutorialId: string, title: string, ownerId: string, ttsEnabled: boolean) {
  const baseSelect =
    'id, step_number, user_title, ai_title, user_script, ai_description, ' +
    'page_url, element_selector, element_xpath, element_rect, click_x, click_y, screenshot_url, user_annotations, follow_config, type_text, ' +
    'voice_audio_url, voice_audio_start_ms, voice_audio_end_ms';
  let { data: rawSteps, error: stepsError } = await supabase
    .from('mm_steps')
    .select(`${baseSelect}, target_context, step_type, capture_source, capture_failure_reason`)
    .eq('tutorial_id', tutorialId)
    .order('order_index')
    .order('step_number'); // tie-break: order_index 동률/NULL(복제·레거시 데이터)일 때 순서 결정성 보장

  if (isMissingExceptionStepColumns(stepsError)) {
    const retry = await supabase
      .from('mm_steps')
      .select(baseSelect)
      .eq('tutorial_id', tutorialId)
      .order('order_index')
      .order('step_number');
    rawSteps = retry.data as unknown as typeof rawSteps;
    stepsError = retry.error;
  }

  if (stepsError) {
    return { tutorial_id: tutorialId, title, steps: [] };
  }

  const { data: owner } = await supabase
    .from('mm_users')
    .select('plan')
    .eq('id', ownerId)
    .single();
  const ownerPlan = owner?.plan ?? 'free';

  let voiceEnabled = false;
  let audioAssets: { step_id: string; audio_url: string; duration_ms?: number | null; script_text?: string | null }[] = [];
  if (ttsEnabled && rawSteps?.length) {
    voiceEnabled = isPaidPlan(ownerPlan);
    if (voiceEnabled) {
      const stepIds = rawSteps.map(s => s.id).filter((stepId): stepId is string => typeof stepId === 'string');
      const { data: assets } = await supabase
        .from('mm_audio_assets')
        .select('step_id, audio_url, duration_ms, script_text')
        .in('step_id', stepIds);
      audioAssets = assets ?? [];
    }
  }

  const steps = ((rawSteps ?? []) as unknown as Record<string, unknown>[]).map(s => {
    const fc = (s.follow_config ?? {}) as {
      kind?: string | null; typeText?: string | null; hidden?: boolean;
      hotspotX?: number | null; hotspotY?: number | null; bubbleAnchor?: string | null;
    };
    const stepType = (s.step_type as string | null) ?? 'normal_interactive_step';
    const explanationOnly = stepType === 'visual_only_step'
      || stepType === 'visual_overlay_step'
      || stepType === 'manual_capture_step'
      || stepType === 'blocked_step'
      || fc.kind === 'none'
      || (!s.element_selector && !s.element_xpath && s.click_x == null && s.click_y == null);
    const audio = resolveStepAudio({
      id: s.id as string,
      user_script: (s.user_script || s.ai_description || '') as string,
      voice_audio_url: (s.voice_audio_url as string | null) ?? null,
      voice_audio_start_ms: (s.voice_audio_start_ms as number | null) ?? null,
      voice_audio_end_ms: (s.voice_audio_end_ms as number | null) ?? null,
    }, audioAssets, voiceEnabled);
    return {
      id: s.id,
      step_number: s.step_number,
      title: maskManualCopy((s.user_title || s.ai_title) as string) || `Step ${s.step_number}`,
      instruction: maskManualCopy((s.user_script || s.ai_description || '') as string),
      page_url: s.page_url ?? null,
      element_selector: explanationOnly ? null : (s.element_selector ?? null),
      element_xpath: explanationOnly ? null : (s.element_xpath ?? null),
      element_rect: explanationOnly ? null : (s.element_rect ?? null),
      target_context: explanationOnly ? null : (s.target_context ?? null),
      click_x: explanationOnly ? null : (s.click_x ?? null),
      click_y: explanationOnly ? null : (s.click_y ?? null),
      screenshot_url: s.screenshot_url ?? null,
      user_annotations: (s.user_annotations as unknown[] | null) ?? [],
      step_type: stepType,
      capture_source: s.capture_source ?? null,
      capture_failure_reason: s.capture_failure_reason ?? null,
      guide_mode: explanationOnly ? 'explanation' : 'interactive',
      // 라이브 가이드 자동입력용 — 스튜디오 오버라이드(fc.typeText) 우선, 없으면 캡처 원문(s.type_text) 폴백
      kind: explanationOnly ? 'none' : (fc.kind ?? null),
      type_text: maskManualCopy(fc.typeText ?? (s.type_text as string | null)) || null,
      hidden: !!fc.hidden,
      // 소유자가 스튜디오에서 직접 보정한 핫스팟(0~100%)·말풍선 위치 — 라이브 가이드가 우선 적용
      hotspot_x: fc.hotspotX ?? null,
      hotspot_y: fc.hotspotY ?? null,
      bubble_anchor: fc.bubbleAnchor ?? null,
      audio_url: audio?.url ?? null,
      audio_start_ms: audio?.startMs ?? null,
      audio_end_ms: audio?.endMs ?? null,
    };
  });

  // 숨김 스텝은 따라하기/라이브 가이드에서 제외 (일관성)
  return {
    tutorial_id: tutorialId,
    title: maskManualCopy(title),
    tts_enabled: voiceEnabled,
    survey: {
      enabled: !isPaidPlan(ownerPlan),
      context: 'live_guide',
    },
    steps: steps.filter(s => !s.hidden),
  };
}

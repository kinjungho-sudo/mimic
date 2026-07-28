import { getBrandAppUrl } from '@/lib/brand';
import { ENTITLEMENT_UPGRADE_COPY, hasEntitlement } from '@/lib/entitlements';
import { maskManualCopy } from '@/lib/manual-quality';
import { isPaidPlan } from '@/lib/plan';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { resolveStepAudio } from '@/lib/voice/playback';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export type LiveGuideStep = Record<string, unknown> & {
  id: unknown;
  title: string;
  instruction: string;
  page_url: unknown;
  hidden: boolean;
};

export type LiveGuidePayload = {
  tutorial_id: string;
  title: string;
  tts_enabled?: boolean;
  survey?: { enabled: boolean; context: 'live_guide' };
  steps: LiveGuideStep[];
};

function isMissingExceptionStepColumns(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === '42703'
    || /step_type|capture_source|capture_failure_reason/i.test(error?.message ?? '');
}

// 소유자 플랜으로 게이트 판정. Live Guide는 Pro 이상에서 제공한다.
export async function gateLiveGuide(
  supabase: ServiceClient,
  ownerId: string,
): Promise<{ gated: true; limit: number; used: number; upgradeUrl: string; error: string } | null> {
  const { data: owner } = await supabase
    .from('mm_users')
    .select('plan, live_guide_runs')
    .eq('id', ownerId)
    .single();

  const plan = owner?.plan ?? 'free';
  if (hasEntitlement(plan, 'live_guide')) return null;
  return {
    gated: true as const,
    limit: 0,
    used: owner?.live_guide_runs ?? 0,
    upgradeUrl: `${getBrandAppUrl()}/landingpage#pricing`,
    error: ENTITLEMENT_UPGRADE_COPY.live_guide,
  };
}

export async function fetchLiveGuideSteps(
  supabase: ServiceClient,
  tutorialId: string,
  title: string,
  ownerId: string,
  ttsEnabled: boolean,
): Promise<LiveGuidePayload> {
  const baseSelect =
    'id, step_number, user_title, ai_title, user_script, ai_description, ' +
    'page_url, element_selector, element_xpath, element_rect, click_x, click_y, screenshot_url, user_annotations, follow_config, type_text, ' +
    'voice_audio_url, voice_audio_start_ms, voice_audio_end_ms';
  let { data: rawSteps, error: stepsError } = await supabase
    .from('mm_steps')
    .select(`${baseSelect}, target_context, step_type, capture_source, capture_failure_reason`)
    .eq('tutorial_id', tutorialId)
    .order('order_index')
    .order('step_number');

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
    voiceEnabled = hasEntitlement(ownerPlan, 'ai_voice');
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
      kind: explanationOnly ? 'none' : (fc.kind ?? null),
      type_text: maskManualCopy(fc.typeText ?? (s.type_text as string | null)) || null,
      hidden: !!fc.hidden,
      hotspot_x: fc.hotspotX ?? null,
      hotspot_y: fc.hotspotY ?? null,
      bubble_anchor: fc.bubbleAnchor ?? null,
      audio_url: audio?.url ?? null,
      audio_start_ms: audio?.startMs ?? null,
      audio_end_ms: audio?.endMs ?? null,
    } satisfies LiveGuideStep;
  });

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

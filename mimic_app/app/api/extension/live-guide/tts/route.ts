import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireExtensionToken } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { hasEntitlement } from '@/lib/entitlements';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { currentStepScript, isFreshVoiceAsset } from '@/lib/voice/playback';
import { generateTTS } from '@/lib/voice/openai-tts';

const bodySchema = z.object({
  tutorial_id: z.string().uuid(),
  step_id: z.string().uuid(),
  guide_token: z.string().min(1).max(80),
});

async function canUseGuide(tutorialId: string, guideToken: string, userId: string) {
  const uuidToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guideToken);
  if (uuidToken) {
    if (guideToken !== tutorialId) return false;
    return (await guardTutorialAccess(tutorialId, userId, 'viewer')).ok;
  }
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('mm_tutorials')
    .select('id')
    .eq('id', tutorialId)
    .eq('share_token', guideToken)
    .eq('status', 'published')
    .maybeSingle();
  return !!data;
}

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  if (!(await canUseGuide(body.tutorial_id, body.guide_token, auth.userId))) {
    return NextResponse.json({ error: 'Guide access denied' }, { status: 403 });
  }

  const supabase = createServiceRoleClient();
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id, user_id, tts_enabled')
    .eq('id', body.tutorial_id)
    .maybeSingle();
  if (!tutorial?.tts_enabled) return NextResponse.json({ error: 'TTS disabled' }, { status: 403 });

  const { data: owner } = await supabase.from('mm_users').select('plan').eq('id', tutorial.user_id).single();
  if (!hasEntitlement(owner?.plan, 'ai_voice')) {
    return NextResponse.json({ error: 'AI voice unavailable' }, { status: 403 });
  }

  const { data: step } = await supabase
    .from('mm_steps')
    .select('id, user_script, ai_description, voice_audio_url, voice_audio_start_ms, voice_audio_end_ms')
    .eq('id', body.step_id)
    .eq('tutorial_id', body.tutorial_id)
    .maybeSingle();
  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 });
  if (step.voice_audio_url) {
    return NextResponse.json({
      audio_url: step.voice_audio_url,
      audio_start_ms: step.voice_audio_start_ms ?? null,
      audio_end_ms: step.voice_audio_end_ms ?? null,
      source: 'human',
    });
  }

  const scriptText = currentStepScript(step);
  if (!scriptText) return NextResponse.json({ error: 'No narration text' }, { status: 400 });
  const { data: asset } = await supabase
    .from('mm_audio_assets')
    .select('step_id, audio_url, duration_ms, script_text')
    .eq('step_id', body.step_id)
    .maybeSingle();
  if (isFreshVoiceAsset(step, asset)) {
    return NextResponse.json({ audio_url: asset!.audio_url, audio_start_ms: null, audio_end_ms: null, source: 'openai' });
  }

  const generated = await generateTTS(body.step_id, scriptText, 'cedar');
  return NextResponse.json({ ...generated, audio_start_ms: null, audio_end_ms: null, source: 'openai' });
}

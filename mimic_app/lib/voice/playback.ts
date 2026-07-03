export type VoiceStep = {
  id: string;
  user_script?: string | null;
  ai_description?: string | null;
  caption?: string | null;
  voice_audio_url?: string | null;
  voice_audio_start_ms?: number | null;
  voice_audio_end_ms?: number | null;
};

export type VoiceAsset = {
  step_id: string;
  audio_url: string;
  duration_ms?: number | null;
  script_text?: string | null;
};

export type ResolvedStepAudio =
  | {
      source: 'human';
      url: string;
      startMs: number | null;
      endMs: number | null;
    }
  | {
      source: 'tts';
      url: string;
      startMs: null;
      endMs: null;
    };

export function normalizeVoiceScript(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function currentStepScript(step: VoiceStep): string {
  return normalizeVoiceScript(step.user_script ?? step.caption ?? step.ai_description ?? '');
}

export function isFreshVoiceAsset(step: VoiceStep, asset: VoiceAsset | null | undefined): boolean {
  if (!asset?.audio_url) return false;
  return normalizeVoiceScript(asset.script_text) === currentStepScript(step);
}

export function resolveStepAudio(
  step: VoiceStep | null | undefined,
  assets: VoiceAsset[] | null | undefined,
  enabled: boolean
): ResolvedStepAudio | null {
  if (!enabled || !step) return null;
  if (step.voice_audio_url) {
    return {
      source: 'human',
      url: step.voice_audio_url,
      startMs: step.voice_audio_start_ms ?? null,
      endMs: step.voice_audio_end_ms ?? null,
    };
  }

  const asset = (assets ?? []).find(a => a.step_id === step.id);
  if (!isFreshVoiceAsset(step, asset)) return null;
  return {
    source: 'tts',
    url: asset!.audio_url,
    startMs: null,
    endMs: null,
  };
}

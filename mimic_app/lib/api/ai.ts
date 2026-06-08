import type { Step, Marker, Annotation } from '@/types';

async function apiFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json();
}

export async function generateScript(
  steps: Step[],
  userDraft?: string
): Promise<{ script: string; markerPositions: number[] }> {
  return apiFetch('/api/generate-script', { steps, userDraft });
}

export async function generateMarkers(steps: Step[]): Promise<Marker[]> {
  const data = await apiFetch<{ markers: Marker[] }>('/api/generate-markers', { steps });
  return data.markers;
}

export async function generateAnnotations(
  stepId: string,
  prompt: string
): Promise<Annotation[]> {
  const data = await apiFetch<{ annotations: Annotation[] }>('/api/generate-annotations', {
    stepId,
    userPrompt: prompt,
  });
  return data.annotations;
}

export async function generateTTS(
  stepId: string,
  script: string,
  voice?: 'nova' | 'alloy'
): Promise<{ audio_url: string; duration_ms: number }> {
  return apiFetch('/api/tts', { stepId, scriptText: script, voice });
}

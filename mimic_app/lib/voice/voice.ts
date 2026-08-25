import OpenAI, { toFile } from 'openai';

// 음성 녹음 → Whisper 전사 → 스텝별 구간 배분.
// 녹화 중 사용자가 연속으로 말한 설명을, 각 캡처의 상대 시각(audio_offset_ms)을 기준으로
// 스텝에 나눠 붙인다. "행동 후 설명" / "설명하며 다음 행동" 양쪽 패턴을 모두 커버하기 위해,
// 각 발화 세그먼트는 '그 시점 직전에 캡처된 스텝'(가장 큰 offset ≤ 세그먼트 시작)에 귀속한다.

export interface WhisperSegment {
  start: number; // 초
  end: number;   // 초
  text: string;
}

// Whisper verbose_json으로 세그먼트 타임스탬프 포함 전사
export async function transcribeAudio(audioUrl: string): Promise<WhisperSegment[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`audio fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = await toFile(buf, 'voice.webm', { type: 'audio/webm' });

  const result = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'ko',
    response_format: 'verbose_json',
  });

  const segments = (result as unknown as { segments?: Array<{ start: number; end: number; text: string }> }).segments;
  if (!Array.isArray(segments)) return [];
  return segments
    .map(s => ({ start: s.start, end: s.end, text: (s.text || '').trim() }))
    .filter(s => s.text.length > 0);
}

// 세그먼트를 스텝에 배분. steps는 step_number 오름차순, offsetMs는 각 스텝의 캡처 시각(ms).
// 반환: step_number → 합쳐진 원문 전사
export function assignSegmentsToSteps(
  segments: WhisperSegment[],
  steps: Array<{ step_number: number; offset_ms: number | null }>,
): Map<number, string> {
  const byStep = new Map<number, string[]>();
  // offset이 있는 스텝만 경계로 사용 (없으면 배분 불가 — 첫 스텝으로 폴백)
  const ordered = steps
    .filter(s => s.offset_ms != null)
    .sort((a, b) => (a.offset_ms as number) - (b.offset_ms as number));

  if (ordered.length === 0) {
    // 타임스탬프 없음 — 전체를 첫 스텝에 몰아준다
    const first = steps[0]?.step_number;
    if (first != null && segments.length) {
      byStep.set(first, segments.map(s => s.text));
    }
    return collapse(byStep);
  }

  for (const seg of segments) {
    const segMidMs = ((seg.start + seg.end) / 2) * 1000;
    // 세그먼트 중점 직전에 캡처된 스텝(가장 큰 offset ≤ 중점). 첫 스텝 이전이면 첫 스텝.
    let target = ordered[0].step_number;
    for (const s of ordered) {
      if ((s.offset_ms as number) <= segMidMs) target = s.step_number;
      else break;
    }
    if (!byStep.has(target)) byStep.set(target, []);
    byStep.get(target)!.push(seg.text);
  }
  return collapse(byStep);
}

function collapse(byStep: Map<number, string[]>): Map<number, string> {
  const out = new Map<number, string>();
  byStep.forEach((arr, k) => {
    const joined = arr.join(' ').replace(/\s+/g, ' ').trim();
    if (joined) out.set(k, joined);
  });
  return out;
}

// 스텝별 음성 구간 [start_ms, end_ms] — 재생 시킹용. offset 기준 경계.
export function computeStepWindows(
  steps: Array<{ step_number: number; offset_ms: number | null }>,
  totalDurationMs: number,
): Map<number, { start_ms: number; end_ms: number }> {
  const out = new Map<number, { start_ms: number; end_ms: number }>();
  const ordered = steps
    .filter(s => s.offset_ms != null)
    .sort((a, b) => (a.offset_ms as number) - (b.offset_ms as number));
  for (let i = 0; i < ordered.length; i++) {
    const start = Math.max(0, ordered[i].offset_ms as number);
    const end = i + 1 < ordered.length ? (ordered[i + 1].offset_ms as number) : totalDurationMs;
    out.set(ordered[i].step_number, { start_ms: Math.round(start), end_ms: Math.round(Math.max(end, start)) });
  }
  return out;
}

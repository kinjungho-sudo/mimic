import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { ttsSchema } from '@/lib/validators';
import { generateTTS } from '@/lib/openai-tts';
import { rateLimitAi } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimitAi(auth.userId);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ttsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await generateTTS(
      parsed.data.stepId,
      parsed.data.scriptText,
      parsed.data.voice
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error('tts error:', err);
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 });
  }
}

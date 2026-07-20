import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { ttsSchema } from '@/lib/validators';
import { generateTTS } from '@/lib/voice/openai-tts';
import { rateLimitAi } from '@/lib/rate-limit';
import { guardStepAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { hasEntitlement } from '@/lib/entitlements';

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

  const guard = await guardStepAccess(parsed.data.stepId, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();
  const { data: user } = await supabase
    .from('mm_users')
    .select('plan')
    .eq('id', auth.userId)
    .single();

  if (!hasEntitlement(user?.plan, 'ai_voice')) {
    return NextResponse.json(
      { error: 'AI voice is available on Pro or Team plans.' },
      { status: 403 }
    );
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

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { generateScriptSchema } from '@/lib/validators';
import { generateScript } from '@/lib/ai/claude';
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

  const parsed = generateScriptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await generateScript(parsed.data.steps, parsed.data.userDraft);
    return NextResponse.json(result);
  } catch (err) {
    console.error('generate-script error:', err);
    return NextResponse.json({ error: 'Script generation failed' }, { status: 500 });
  }
}

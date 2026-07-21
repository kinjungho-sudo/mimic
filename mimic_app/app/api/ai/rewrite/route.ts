import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { hasAnthropicApiKey, rewriteSentence } from '@/lib/ai/claude';
import { validateGeneratedManualScript } from '@/lib/ai/text-quality';
import { rateLimitAi } from '@/lib/rate-limit';
import { z } from 'zod';
import { requireUserEntitlement } from '@/lib/auth/entitlement-guard';

const rewriteSchema = z.object({
  text: z.string().min(1).max(500),
  instruction: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const entitlement = await requireUserEntitlement(auth.userId, 'ai_rewrite');
  if (!entitlement.ok) return entitlement.response;

  const limited = rateLimitAi(auth.userId);
  if (limited) return limited;

  if (!hasAnthropicApiKey()) {
    return NextResponse.json({ error: 'AI provider is not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = rewriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await rewriteSentence(parsed.data.text, parsed.data.instruction);
  const quality = validateGeneratedManualScript(result);
  if (!quality.ok) {
    return NextResponse.json(
      { error: 'AI rewrite was empty or low quality', reason: quality.reason },
      { status: 422 }
    );
  }

  return NextResponse.json({ result: quality.text });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { hasOpenAIApiKey, rewriteAllSteps } from '@/lib/ai/claude';
import { keepUsableRewriteResults } from '@/lib/ai/text-quality';
import { rateLimitAi } from '@/lib/rate-limit';
import { z } from 'zod';

const schema = z.object({
  steps: z.array(z.object({ id: z.string(), text: z.string().max(500) })).min(1).max(100),
  instruction: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const limited = rateLimitAi(auth.userId);
  if (limited) return limited;

  if (!hasOpenAIApiKey()) {
    return NextResponse.json({ error: 'AI provider is not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let results: unknown;
  try {
    const generated = await rewriteAllSteps(parsed.data.steps, parsed.data.instruction);
    results = keepUsableRewriteResults(parsed.data.steps, generated);
  } catch (err) {
    console.error('[rewrite-all] OpenAI error:', err);
    return NextResponse.json({ error: 'AI 처리 중 오류가 발생했습니다.' }, { status: 502 });
  }
  return NextResponse.json({ results });
}

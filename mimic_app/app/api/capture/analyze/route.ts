import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth/auth-guard';
import { captureAnalyzeSchema } from '@/lib/validators';
import { analyzeScreenshot } from '@/lib/ai/claude';
import { rateLimitAi } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimitAi(auth.userId);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = captureAnalyzeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { image, url, actionInfo, elementRect, viewportW, viewportH, elementSelector, clickX, clickY } = parsed.data;
    const result = await analyzeScreenshot(image, url, actionInfo, {
      clickX:          clickX  ?? undefined,
      clickY:          clickY  ?? undefined,
      elementRect:     elementRect ?? undefined,
      viewportW:       viewportW   ?? undefined,
      viewportH:       viewportH   ?? undefined,
      elementSelector: elementSelector ?? undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Claude analyze error:', err);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}

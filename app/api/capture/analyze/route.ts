import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { captureAnalyzeSchema } from '@/lib/validators';
import { analyzeScreenshot } from '@/lib/claude';
import { rateLimitAi } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  // 토큰으로 user_id 조회 (rate limit 키로 사용)
  const supabase = createServiceRoleClient();
  const { data: tokenRow } = await supabase
    .from('mm_extension_tokens')
    .select('user_id')
    .eq('token', auth.token)
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const limited = rateLimitAi(tokenRow.user_id);
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
    const result = await analyzeScreenshot(parsed.data.image, parsed.data.url);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Claude analyze error:', err);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}

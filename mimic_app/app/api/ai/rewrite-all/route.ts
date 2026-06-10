import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { rewriteAllSteps } from '@/lib/claude';
import { z } from 'zod';

const schema = z.object({
  steps: z.array(z.object({ id: z.string(), text: z.string().max(500) })).min(1).max(100),
  instruction: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    results = await rewriteAllSteps(parsed.data.steps, parsed.data.instruction);
  } catch (err) {
    console.error('[rewrite-all] Claude error:', err);
    return NextResponse.json({ error: 'AI 처리 중 오류가 발생했습니다.' }, { status: 502 });
  }
  return NextResponse.json({ results });
}

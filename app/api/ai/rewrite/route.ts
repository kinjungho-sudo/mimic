import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { rewriteSentence } from '@/lib/claude';
import { z } from 'zod';

const rewriteSchema = z.object({
  text: z.string().min(1).max(500),
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

  const parsed = rewriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await rewriteSentence(parsed.data.text, parsed.data.instruction);
  return NextResponse.json({ result });
}

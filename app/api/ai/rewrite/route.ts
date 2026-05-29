import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { rewriteSentence } from '@/lib/claude';

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text, instruction } = await req.json();
  if (!text || !instruction) {
    return NextResponse.json({ error: 'text and instruction are required' }, { status: 400 });
  }

  const result = await rewriteSentence(String(text), String(instruction));
  return NextResponse.json({ result });
}

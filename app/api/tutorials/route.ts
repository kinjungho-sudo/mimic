import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('mm_tutorials')
    .select(`
      *,
      mm_steps (
        screenshot_url,
        step_number
      )
    `)
    .eq('user_id', auth.userId)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = (data ?? []).map((t: Record<string, unknown> & { mm_steps?: { screenshot_url: string; step_number: number }[] }) => {
    const steps = t.mm_steps ?? [];
    const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);
    const { mm_steps, ...rest } = t;
    void mm_steps;
    return {
      ...rest,
      step_count: steps.length,
      thumbnail_url: sorted[0]?.screenshot_url ?? null,
      cover_color: (rest.cover_color as string | null) ?? null,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('mm_tutorials')
    .insert({ user_id: auth.userId, title: '제목 없음', status: 'draft', mode: 'guide' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

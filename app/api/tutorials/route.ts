import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();
  // workspace_id 파라미터가 있으면 팀 매뉴얼 조회
  const workspaceId = request.nextUrl.searchParams.get('workspace_id');

  let query = supabase
    .from('mm_tutorials')
    .select(`*, mm_steps(screenshot_url, page_url, step_number)`)
    .order('updated_at', { ascending: false });

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  } else {
    query = query.eq('user_id', auth.userId).is('workspace_id', null);
  }

  // 삭제된 항목 제외
  query = query.is('deleted_at', null);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = (data ?? []).map((t: Record<string, unknown> & { mm_steps?: { screenshot_url: string; page_url: string | null; step_number: number }[] }) => {
    const steps = t.mm_steps ?? [];
    const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);
    const { mm_steps, ...rest } = t;
    void mm_steps;
    return {
      ...rest,
      step_count: steps.length,
      thumbnail_url: sorted[0]?.screenshot_url ?? null,
      cover_color: (rest.cover_color as string | null) ?? null,
      first_page_url: sorted[0]?.page_url ?? null,
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

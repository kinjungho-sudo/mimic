import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { requireWorkspaceEntitlement } from '@/lib/auth/entitlement-guard';

const tutorialCreateSchema = z.object({
  workspace_id: z.string().uuid().optional().nullable(),
}).optional();

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
    // 워크스페이스 멤버 또는 owner인지 확인
    const { data: ws } = await supabase
      .from('mm_workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const isOwner = ws.owner_id === auth.userId;
    if (!isOwner) {
      const { data: member } = await supabase
        .from('mm_workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', auth.userId)
        .single();

      if (!member) {
        return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });
      }
    }

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

  // workspace_id가 있으면 팀 매뉴얼로 생성 — 멤버 여부 확인
  let workspaceId: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = tutorialCreateSchema?.safeParse(body);
    workspaceId = parsed?.data?.workspace_id ?? null;
  } catch { /* body 없으면 개인 매뉴얼 */ }

  const supabase = createServiceRoleClient();

  if (workspaceId) {
    const entitlement = await requireWorkspaceEntitlement(workspaceId, 'team_workspace', supabase);
    if (!entitlement.ok) return entitlement.response;

    // 워크스페이스 멤버 또는 owner인지 확인 (editor 이상만 생성 가능)
    const { data: ws } = await supabase
      .from('mm_workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    const isOwner = ws?.owner_id === auth.userId;

    if (!isOwner) {
      const { data: member } = await supabase
        .from('mm_workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', auth.userId)
        .single();

      if (!member || member.role === 'viewer') {
        return NextResponse.json({ error: 'Requires editor role or above' }, { status: 403 });
      }
    }
  }

  const { data, error } = await supabase
    .from('mm_tutorials')
    .insert({
      user_id: auth.userId,
      workspace_id: workspaceId,
      title: '제목 없음',
      status: 'draft',
      mode: 'guide',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

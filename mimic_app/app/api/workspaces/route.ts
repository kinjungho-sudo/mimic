import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createSchema = z.object({ name: z.string().min(1).max(50) });

// GET /api/workspaces — 내가 속한 워크스페이스 목록
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // 내가 소유하거나 멤버인 워크스페이스
  const { data: memberRows } = await supabase
    .from('mm_workspace_members')
    .select('workspace_id, role')
    .eq('user_id', auth.userId);

  const { data: owned } = await supabase
    .from('mm_workspaces')
    .select('*, mm_workspace_members(count)')
    .eq('owner_id', auth.userId);

  const memberWsIds = (memberRows ?? []).map(r => r.workspace_id);
  const { data: memberWs } = memberWsIds.length
    ? await supabase
        .from('mm_workspaces')
        .select('*, mm_workspace_members(count)')
        .in('id', memberWsIds)
    : { data: [] };

  const roleMap = Object.fromEntries((memberRows ?? []).map(r => [r.workspace_id, r.role]));

  const all = [
    ...(owned ?? []).map(ws => ({
      ...ws,
      my_role: 'admin' as const,
      member_count: (ws.mm_workspace_members as { count: number }[])?.[0]?.count ?? 0,
      mm_workspace_members: undefined,
    })),
    ...(memberWs ?? []).map(ws => ({
      ...ws,
      my_role: roleMap[ws.id] ?? 'viewer',
      member_count: (ws.mm_workspace_members as { count: number }[])?.[0]?.count ?? 0,
      mm_workspace_members: undefined,
    })),
  ];

  // 중복 제거 (소유자가 멤버 테이블에도 있을 수 있음)
  const seen = new Set<string>();
  const unique = all.filter(ws => { if (seen.has(ws.id)) return false; seen.add(ws.id); return true; });

  return NextResponse.json(unique);
}

// POST /api/workspaces — 워크스페이스 생성
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = createServiceRoleClient();

  const { data: ws, error } = await supabase
    .from('mm_workspaces')
    .insert({ name: parsed.data.name, owner_id: auth.userId })
    .select()
    .single();

  if (error || !ws) return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });

  // 생성자를 admin 멤버로 추가
  await supabase.from('mm_workspace_members').insert({
    workspace_id: ws.id,
    user_id: auth.userId,
    role: 'admin',
  });

  return NextResponse.json({ ...ws, my_role: 'admin', member_count: 1 }, { status: 201 });
}

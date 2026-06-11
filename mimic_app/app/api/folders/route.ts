import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardWorkspaceAccess } from '@/lib/workspace-guard';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  workspace_id: z.string().uuid().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const workspaceId = request.nextUrl.searchParams.get('workspace_id');
  const supabase = createServiceRoleClient();

  if (workspaceId) {
    // 팀 공유 폴더 — 멤버(viewer 이상)면 조회 가능
    const guard = await guardWorkspaceAccess(workspaceId, auth.userId, 'viewer');
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const { data } = await supabase
      .from('mm_folders')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    return NextResponse.json(data ?? []);
  }

  // 개인 폴더
  const { data } = await supabase
    .from('mm_folders')
    .select('*')
    .eq('user_id', auth.userId)
    .is('workspace_id', null)
    .order('created_at', { ascending: true });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = parsed.data.workspace_id ?? null;
  if (workspaceId) {
    // 팀 폴더 생성 — editor 이상
    const guard = await guardWorkspaceAccess(workspaceId, auth.userId, 'editor');
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('mm_folders')
    .insert({ user_id: auth.userId, name: parsed.data.name, color: parsed.data.color ?? '#3730a3', workspace_id: workspaceId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

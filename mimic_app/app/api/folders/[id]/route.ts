import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardWorkspaceAccess } from '@/lib/workspace-guard';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// 폴더 접근 권한: 팀 폴더면 멤버(editor+), 개인이면 소유자.
async function authorizeFolder(folderId: string, userId: string) {
  const supabase = createServiceRoleClient();
  const { data: folder } = await supabase
    .from('mm_folders')
    .select('id, user_id, workspace_id')
    .eq('id', folderId)
    .single();
  if (!folder) return { ok: false as const, status: 404 as const, error: 'Not found' };
  if (folder.workspace_id) {
    const guard = await guardWorkspaceAccess(folder.workspace_id, userId, 'editor');
    if (!guard.ok) return { ok: false as const, status: guard.status, error: guard.error };
    return { ok: true as const };
  }
  if (folder.user_id !== userId) return { ok: false as const, status: 403 as const, error: 'Forbidden' };
  return { ok: true as const };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const access = await authorizeFolder(id, auth.userId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('mm_folders')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const access = await authorizeFolder(id, auth.userId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const supabase = createServiceRoleClient();
  // 폴더 안 튜토리얼은 folder_id = null 으로 (ON DELETE SET NULL 으로 자동 처리)
  await supabase.from('mm_folders').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}

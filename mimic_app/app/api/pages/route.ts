import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardWorkspaceAccess } from '@/lib/auth/workspace-guard';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().max(200).optional(),
  workspace_id: z.string().uuid().nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
}).optional();

// GET /api/pages              — 개인 페이지 목록
// GET /api/pages?workspace_id — 팀 페이지 목록 (viewer 이상)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();
  const workspaceId = request.nextUrl.searchParams.get('workspace_id');

  let query = supabase
    .from('mm_pages')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (workspaceId) {
    const guard = await guardWorkspaceAccess(workspaceId, auth.userId, 'viewer');
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    query = query.eq('workspace_id', workspaceId);
  } else {
    query = query.eq('user_id', auth.userId).is('workspace_id', null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (data ?? []).map(p => {
    const content = (p as typeof p & { content?: unknown }).content;
    return { ...p, block_count: Array.isArray(content) ? content.length : 0 };
  });

  return NextResponse.json(enriched);
}

// POST /api/pages — 페이지 생성
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema?.safeParse(body);
  if (parsed && !parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed?.data ?? {};
  const workspaceId = input.workspace_id ?? null;

  if (workspaceId) {
    const guard = await guardWorkspaceAccess(workspaceId, auth.userId, 'editor');
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('mm_pages')
    .insert({
      user_id: auth.userId,
      workspace_id: workspaceId,
      folder_id: input.folder_id ?? null,
      title: input.title ?? '제목 없는 페이지',
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

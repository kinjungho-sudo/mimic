import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardPageAccess } from '@/lib/workspace-guard';
import { randomBytes } from 'crypto';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  cover_color: z.string().max(32).nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  publish: z.boolean().optional(),
  unpublish: z.boolean().optional(),
});

// GET /api/pages/[id] — 페이지 + 정렬된 블록
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const guard = await guardPageAccess(id, auth.userId, 'viewer');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const supabase = createServiceRoleClient();
  const { data: page } = await supabase.from('mm_pages').select('*').eq('id', id).single();
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: blocks } = await supabase
    .from('mm_page_blocks')
    .select('*')
    .eq('page_id', id)
    .order('order_index', { ascending: true });

  return NextResponse.json({ ...page, blocks: blocks ?? [] });
}

// PATCH /api/pages/[id] — 메타 수정 / 게시 / 게시 취소
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const guard = await guardPageAccess(id, auth.userId, 'editor');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = createServiceRoleClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const { title, description, cover_color, folder_id, publish, unpublish } = parsed.data;
  if (title !== undefined) update.title = title;
  if (description !== undefined) update.description = description;
  if (cover_color !== undefined) update.cover_color = cover_color;
  if (folder_id !== undefined) update.folder_id = folder_id;

  if (publish) {
    const { data: cur } = await supabase.from('mm_pages').select('share_token').eq('id', id).single();
    update.status = 'published';
    update.visibility = 'public';
    update.published_at = new Date().toISOString();
    if (!cur?.share_token) update.share_token = randomBytes(16).toString('hex');
  } else if (unpublish) {
    update.status = 'draft';
    update.visibility = 'private';
    update.share_token = null;
  }

  const { data, error } = await supabase
    .from('mm_pages')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/pages/[id] — 소프트 삭제 (휴지통)
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const guard = await guardPageAccess(id, auth.userId, 'editor');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('mm_pages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}

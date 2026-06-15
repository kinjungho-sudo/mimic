import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardPageAccess } from '@/lib/workspace-guard';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const blockSchema = z.object({
  block_type: z.enum(['heading', 'text', 'video', 'tutorial']),
  content: z.record(z.string(), z.unknown()).default({}),
});
const putSchema = z.object({ blocks: z.array(blockSchema).max(200) });

// PUT /api/pages/[id]/blocks — 전체 블록을 순서대로 교체 (추가/삭제/정렬/수정 일괄 반영)
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const guard = await guardPageAccess(id, auth.userId, 'editor');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = putSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = createServiceRoleClient();

  // 기존 블록 제거 후 순서대로 재삽입
  const { error: delErr } = await supabase.from('mm_page_blocks').delete().eq('page_id', id);
  if (delErr) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  const rows = parsed.data.blocks.map((b, i) => ({
    page_id: id,
    order_index: i,
    block_type: b.block_type,
    content: b.content,
  }));

  if (rows.length === 0) {
    await supabase.from('mm_pages').update({ updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ blocks: [] });
  }

  const { data, error } = await supabase
    .from('mm_page_blocks')
    .insert(rows)
    .select('*')
    .order('order_index', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('mm_pages').update({ updated_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ blocks: data ?? [] });
}

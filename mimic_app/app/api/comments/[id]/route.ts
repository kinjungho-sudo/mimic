import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

// DELETE /api/comments/[id] — 본인이 작성한 댓글만 소프트 삭제 (대댓글은 CASCADE)
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: comment } = await supabase
    .from('mm_comments')
    .select('id, author_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (comment.author_id !== auth.userId) {
    return NextResponse.json({ error: '본인 댓글만 삭제할 수 있습니다.' }, { status: 403 });
  }

  const { error } = await supabase
    .from('mm_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}

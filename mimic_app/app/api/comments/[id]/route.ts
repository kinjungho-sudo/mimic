import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardTutorialAccess } from '@/lib/workspace-guard';
import { logActivity } from '@/lib/activity';

type Params = { params: Promise<{ id: string }> };

// PATCH /api/comments/[id] — 해결/재오픈 토글 (접근 권한자 누구나 가능)
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { resolved } = (body ?? {}) as { resolved?: boolean };

  const supabase = createServiceRoleClient();
  const { data: comment } = await supabase
    .from('mm_comments')
    .select('id, tutorial_id, step_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const guard = await guardTutorialAccess(comment.tutorial_id, auth.userId, 'viewer');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data, error } = await supabase
    .from('mm_comments')
    .update({
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? auth.userId : null,
    })
    .eq('id', id)
    .select('id, resolved_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    tutorialId: comment.tutorial_id,
    actorId: auth.userId,
    action: resolved ? 'comment_resolved' : 'comment_reopened',
    stepId: comment.step_id,
  });

  return NextResponse.json({ comment: data });
}

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

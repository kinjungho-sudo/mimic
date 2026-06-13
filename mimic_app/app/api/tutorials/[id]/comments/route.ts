import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardTutorialAccess } from '@/lib/workspace-guard';
import { logActivity } from '@/lib/activity';

type Params = { params: Promise<{ id: string }> };

// GET /api/tutorials/[id]/comments — 매뉴얼의 모든 댓글(+대댓글)을 작성자 정보와 함께 반환
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const guard = await guardTutorialAccess(id, auth.userId, 'viewer');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('mm_comments')
    .select('id, tutorial_id, step_id, parent_id, author_id, body, created_at, resolved_at, author:mm_users!mm_comments_author_id_fkey(name, avatar_url, email)')
    .eq('tutorial_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
}

// POST /api/tutorials/[id]/comments — 댓글 또는 대댓글 작성
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { body: text, step_id, parent_id } = (body ?? {}) as {
    body?: string; step_id?: string | null; parent_id?: string | null;
  };
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: '내용을 입력하세요.' }, { status: 400 });
  }

  const guard = await guardTutorialAccess(id, auth.userId, 'viewer');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('mm_comments')
    .insert({
      tutorial_id: id,
      step_id: step_id ?? null,
      parent_id: parent_id ?? null,
      author_id: auth.userId,
      body: text.trim(),
    })
    .select('id, tutorial_id, step_id, parent_id, author_id, body, created_at, resolved_at, author:mm_users!mm_comments_author_id_fkey(name, avatar_url, email)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    tutorialId: id,
    actorId: auth.userId,
    action: parent_id ? 'reply_added' : 'comment_added',
    stepId: step_id ?? null,
    meta: { snippet: text.trim().slice(0, 60) },
  });

  return NextResponse.json({ comment: data }, { status: 201 });
}

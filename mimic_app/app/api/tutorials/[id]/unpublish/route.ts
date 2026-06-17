import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // 게시 취소도 editor 이상 허용
  const guard = await guardTutorialAccess(id, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('mm_tutorials')
    .update({
      status: 'draft',
      visibility: 'private',
      share_token: null,
      published_at: null,
    })
    .eq('id', id)
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found or unpublish failed' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

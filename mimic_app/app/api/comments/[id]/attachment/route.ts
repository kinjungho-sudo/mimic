import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();
  const { data: comment } = await supabase
    .from('mm_comments')
    .select('tutorial_id, attachment_path')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!comment?.attachment_path) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const guard = await guardTutorialAccess(comment.tutorial_id, auth.userId, 'viewer');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data, error } = await supabase.storage
    .from('live-guide-help')
    .createSignedUrl(comment.attachment_path, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Attachment unavailable' }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl, 307);
}

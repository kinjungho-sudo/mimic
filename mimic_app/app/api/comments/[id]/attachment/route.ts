import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { decryptHelpScreenshot, parseHelpRequestBody } from '@/lib/live-guide/help-request';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();
  const { data: comment } = await supabase
    .from('mm_comments')
    .select('tutorial_id, body')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const guard = await guardTutorialAccess(comment.tutorial_id, auth.userId, 'viewer');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const help = parseHelpRequestBody(comment.body, comment.tutorial_id);
  if (!help?.metadata.path || !help.metadata.mime) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { data, error } = await supabase.storage
    .from('naviaction')
    .download(help.metadata.path);
  if (error || !data) {
    return NextResponse.json({ error: 'Attachment unavailable' }, { status: 404 });
  }
  try {
    const decrypted = decryptHelpScreenshot(Buffer.from(await data.arrayBuffer()), help.metadata);
    return new NextResponse(decrypted, {
      headers: {
        'Content-Type': help.metadata.mime,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Attachment unavailable' }, { status: 404 });
  }
}

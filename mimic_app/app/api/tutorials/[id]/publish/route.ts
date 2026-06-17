import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';
import { guardTutorialAccess } from '@/lib/workspace-guard';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // 게시는 editor 이상 허용
  const guard = await guardTutorialAccess(id, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();

  // 기존 share_token이 있으면 재사용 — 재게시 때마다 새 토큰을 발급하면 이미 공유된 링크가 죽음
  const { data: existing } = await supabase
    .from('mm_tutorials')
    .select('share_token')
    .eq('id', id)
    .single();

  const shareToken = existing?.share_token ?? randomBytes(16).toString('hex');

  const { data, error } = await supabase
    .from('mm_tutorials')
    .update({
      status: 'published',
      visibility: 'public',
      share_token: shareToken,
      published_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('share_token')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found or publish failed' }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json({
    share_token: data.share_token,
    share_url: `${appUrl}/play/${data.share_token}`,
  });
}

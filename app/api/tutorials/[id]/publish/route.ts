import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createServiceRoleClient();

  const shareToken = randomBytes(16).toString('hex');

  const { data, error } = await supabase
    .from('mm_tutorials')
    .update({
      status: 'published',
      visibility: 'public',
      share_token: shareToken,
      published_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', auth.userId)
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

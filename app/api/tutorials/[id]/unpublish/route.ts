import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
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
    .eq('user_id', auth.userId)
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found or unpublish failed' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

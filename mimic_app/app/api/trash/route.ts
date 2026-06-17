import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

// GET /api/trash — 내 휴지통 목록 (삭제된 매뉴얼)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('mm_tutorials')
    .select('id, title, deleted_at, workspace_id, updated_at')
    .eq('user_id', auth.userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

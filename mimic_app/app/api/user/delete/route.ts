import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // 사용자 데이터 삭제 (RLS bypass)
  await supabase.from('mm_tutorials').delete().eq('user_id', auth.userId);
  await supabase.from('mm_users').delete().eq('id', auth.userId);

  // Supabase Auth 계정 삭제
  const { error } = await supabase.auth.admin.deleteUser(auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

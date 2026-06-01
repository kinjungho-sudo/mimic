import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClient();

  // Auth 계정 먼저 삭제 → 실패 시 DB 건드리지 않음
  const { error: authError } = await supabase.auth.admin.deleteUser(auth.userId);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Auth 삭제 성공 후 DB 데이터 정리 (에러 무시 — cascade 또는 재시도 가능)
  await supabase.from('mm_tutorials').delete().eq('user_id', auth.userId);
  await supabase.from('mm_users').delete().eq('id', auth.userId);

  return NextResponse.json({ success: true });
}

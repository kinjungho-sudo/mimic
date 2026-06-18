import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/logging/logger-server';

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
    logAudit('auth.account.delete.fail', { userId: auth.userId, reason: error.message }, 'warn');
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAudit('auth.account.delete', { userId: auth.userId });
  return NextResponse.json({ success: true });
}

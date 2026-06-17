import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/auth-guard';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('mm_users')
    .select('id, email, name, plan, daily_manual_count, daily_limit, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const service = createServiceRoleClient();
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { userId, plan } = await request.json();
  if (!userId || !plan) return NextResponse.json({ error: 'userId and plan required' }, { status: 400 });

  const validPlans = ['free', 'pro', 'team'];
  if (!validPlans.includes(plan)) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const service = createServiceRoleClient();
  const { error } = await service
    .from('mm_users')
    .update({ plan })
    .eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

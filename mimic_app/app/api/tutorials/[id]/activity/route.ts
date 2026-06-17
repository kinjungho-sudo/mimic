import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';

type Params = { params: Promise<{ id: string }> };

// GET /api/tutorials/[id]/activity — 활동 로그(최신순)
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const guard = await guardTutorialAccess(id, auth.userId, 'viewer');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('mm_activity')
    .select('id, action, step_id, meta, created_at, actor:mm_users(name, avatar_url, email), step:mm_steps(step_number)')
    .eq('tutorial_id', id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data ?? [] });
}

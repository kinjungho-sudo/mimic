import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/auth-guard';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const service = createServiceRoleClient();

  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [usersRes, tutorialsRes, enterCountRes, completeCountRes, mauViewsRes, proSignupsRes] = await Promise.all([
    service.from('mm_users').select('id, plan, created_at'),
    service.from('mm_tutorials').select('id, status, created_at'),
    service.from('mm_view_events').select('id', { count: 'exact', head: true }).eq('event_type', 'enter'),
    service.from('mm_view_events').select('id', { count: 'exact', head: true }).eq('event_type', 'complete'),
    service.from('mm_view_events').select('viewer_session_id').eq('event_type', 'enter').gte('timestamp', last30Days).limit(100000),
    service.from('mm_pro_signups').select('id'),
  ]);

  const failed = [usersRes, tutorialsRes, enterCountRes, completeCountRes, mauViewsRes, proSignupsRes].find(result => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const users = usersRes.data ?? [];
  const tutorials = tutorialsRes.data ?? [];
  const proSignups = proSignupsRes.data ?? [];

  const dailySignups: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dailySignups[d.toISOString().slice(0, 10)] = 0;
  }
  users.forEach(u => {
    const day = u.created_at.slice(0, 10);
    if (day in dailySignups) dailySignups[day]++;
  });

  const totalViews = enterCountRes.count ?? 0;
  const totalCompletes = completeCountRes.count ?? 0;
  const mauSessions = new Set((mauViewsRes.data ?? []).map(v => v.viewer_session_id).filter(Boolean));
  const completionRate = totalViews > 0
    ? Math.min(100, Math.round((totalCompletes / totalViews) * 100))
    : 0;

  return NextResponse.json({
    totalUsers: users.length,
    newUsersLast7Days: users.filter(u => u.created_at >= last7Days).length,
    planBreakdown: {
      free: users.filter(u => u.plan === 'free').length,
      pro_waitlist: users.filter(u => u.plan === 'pro_waitlist').length,
      pro: users.filter(u => u.plan === 'pro').length,
      team: users.filter(u => u.plan === 'team').length,
    },
    totalTutorials: tutorials.length,
    publishedTutorials: tutorials.filter(t => t.status === 'published').length,
    newTutorialsLast7Days: tutorials.filter(t => t.created_at >= last7Days).length,
    totalViews,
    totalCompletes,
    proSignupsCount: proSignups.length,
    dailySignups,
    mau: mauSessions.size,
    completionRate,
  });
}

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const service = createServiceRoleClient();

  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [usersRes, tutorialsRes, viewsRes, proSignupsRes] = await Promise.all([
    service.from('mm_users').select('id, plan, created_at'),
    service.from('mm_tutorials').select('id, status, created_at'),
    service.from('mm_view_events').select('id, event_type, timestamp, viewer_session_id'),
    service.from('mm_pro_signups').select('id'),
  ]);

  const users = usersRes.data ?? [];
  const tutorials = tutorialsRes.data ?? [];
  const views = viewsRes.data ?? [];
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

  const enterEvents = views.filter(v => v.event_type === 'enter');
  const completeEvents = views.filter(v => v.event_type === 'complete');

  // MAU: unique viewer sessions with enter event in last 30 days
  const mauSessions = new Set(
    enterEvents.filter(v => v.timestamp >= last30Days).map(v => v.viewer_session_id)
  );

  // Completion rate: sessions that completed / sessions that entered (all time)
  const enterSessions = new Set(enterEvents.map(v => v.viewer_session_id));
  const completeSessions = new Set(completeEvents.map(v => v.viewer_session_id));
  const completionRate = enterSessions.size > 0
    ? Math.round((completeSessions.size / enterSessions.size) * 100)
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
    totalViews: enterEvents.length,
    totalCompletes: completeEvents.length,
    proSignupsCount: proSignups.length,
    dailySignups,
    mau: mauSessions.size,
    completionRate,
  });
}

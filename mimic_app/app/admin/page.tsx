'use client';

import { useEffect, useState } from 'react';
import { BRAND_NAME } from '@/lib/brand';

interface Stats {
  totalUsers: number;
  newUsersLast7Days: number;
  planBreakdown: { free: number; pro_waitlist: number; pro: number; team: number };
  totalTutorials: number;
  publishedTutorials: number;
  newTutorialsLast7Days: number;
  totalViews: number;
  totalCompletes: number;
  proSignupsCount: number;
  dailySignups: Record<string, number>;
  mau: number;
  completionRate: number;
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px' }}>
      <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 600, color: color ?? '#0F172A', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? '통계를 불러오지 못했습니다.');
        return d;
      })
      .then(setStats)
      .catch(e => setError(e instanceof Error ? e.message : '통계를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '48px', color: '#64748B', fontSize: '14px' }}>로딩 중...</div>
    );
  }

  if (!stats) {
    return (
      <div role="alert" style={{ padding: '48px', color: '#EF4444', fontSize: '14px' }}>{error || '데이터를 불러오지 못했습니다.'}</div>
    );
  }

  const chartDays = Object.entries(stats.dailySignups);
  const maxVal = Math.max(...chartDays.map(([, v]) => v), 1);

  return (
    <div className="admin-page" style={{ padding: '36px 40px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px', color: '#0F172A' }}>대시보드</h1>
        <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>{BRAND_NAME} 서비스 현황 요약</p>
      </div>

      {/* 핵심 지표 */}
      <div className="admin-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <StatCard label="전체 유저" value={stats.totalUsers.toLocaleString()} sub={`최근 7일 +${stats.newUsersLast7Days}`} />
        <StatCard label="전체 튜토리얼" value={stats.totalTutorials.toLocaleString()} sub={`공개 ${stats.publishedTutorials}개`} />
        <StatCard label="전체 조회수" value={stats.totalViews.toLocaleString()} sub={`완료 ${stats.totalCompletes}회`} />
        <StatCard label="플랜 출시 알림" value={stats.proSignupsCount.toLocaleString()} color="#12B886" />
      </div>

      {/* MAU + 완료율 */}
      <div className="admin-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#E8FFF7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#009B8E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>MAU (30일)</div>
            <div style={{ fontSize: '32px', fontWeight: 600, color: '#009B8E', lineHeight: 1 }}>{stats.mau.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>최근 30일 고유 진입 세션 기준</div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ECFDF5', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>완료율</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#059669', lineHeight: 1 }}>{stats.completionRate}%</div>
            </div>
            <div style={{ marginTop: '8px', height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${stats.completionRate}%`, background: 'linear-gradient(to right, #059669, #10B981)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="admin-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* 플랜 분포 */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '18px' }}>플랜 분포</div>
          {[
            { label: 'Free', value: stats.planBreakdown.free, color: '#94A3B8' },
            { label: 'Pro 알림', value: stats.planBreakdown.pro_waitlist, color: '#F59E0B' },
            { label: 'Pro', value: stats.planBreakdown.pro, color: '#009B8E' },
            { label: 'Team', value: stats.planBreakdown.team, color: '#12B886' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              <div style={{ fontSize: '13px', color: '#475569', flex: 1 }}>{item.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 2 }}>
                <div style={{ flex: 1, height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${stats.totalUsers > 0 ? (item.value / stats.totalUsers) * 100 : 0}%`, background: item.color, borderRadius: '3px' }} />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A', minWidth: '28px', textAlign: 'right' }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 7일 가입자 추이 */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '18px' }}>최근 7일 신규 가입</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '100px' }}>
            {chartDays.map(([day, count]) => (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>{count}</div>
                <div style={{ width: '100%', height: `${(count / maxVal) * 72}px`, minHeight: '4px', background: 'linear-gradient(to top, #009B8E, #12B886)', borderRadius: '4px 4px 0 0' }} />
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>{day.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

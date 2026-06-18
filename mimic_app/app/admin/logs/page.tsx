'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type LogRow = {
  id: string;
  created_at: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'error' | 'network' | 'audit' | 'system';
  source: 'client' | 'server';
  event: string;
  message: string | null;
  context: Record<string, unknown> | null;
  user_id: string | null;
  tutorial_id: string | null;
  url: string | null;
};

type Summary = { error: number; network: number; audit: number; system: number; errorLevel: number; warnLevel: number; total: number };

const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'error', label: '에러' },
  { key: 'network', label: '네트워크' },
  { key: 'audit', label: '감사' },
  { key: 'system', label: '시스템' },
] as const;

const LEVEL_COLOR: Record<string, { bg: string; fg: string }> = {
  error: { bg: '#FEE2E2', fg: '#B91C1C' },
  warn: { bg: '#FEF3C7', fg: '#B45309' },
  info: { bg: '#E0E7FF', fg: '#3730A3' },
  debug: { bg: '#F1F5F9', fg: '#64748B' },
};
const CAT_COLOR: Record<string, { bg: string; fg: string }> = {
  error: { bg: '#FEE2E2', fg: '#B91C1C' },
  network: { bg: '#DBEAFE', fg: '#1D4ED8' },
  audit: { bg: '#DCFCE7', fg: '#15803D' },
  system: { bg: '#F3E8FF', fg: '#7E22CE' },
};

function Badge({ text, color }: { text: string; color: { bg: string; fg: string } }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, background: color.bg, color: color.fg, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{text}</span>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function AdminLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [category, setCategory] = useState('all');
  const [level, setLevel] = useState('all');
  const [q, setQ] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const qRef = useRef(q);
  qRef.current = q;

  const fetchLogs = useCallback(async (opts?: { before?: string }) => {
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (level !== 'all') params.set('level', level);
    if (qRef.current.trim()) params.set('q', qRef.current.trim());
    if (opts?.before) params.set('before', opts.before);

    const isMore = !!opts?.before;
    if (isMore) setLoadingMore(true); else setLoading(true);
    try {
      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) { if (!isMore) setRows([]); return; }
      setRows(prev => isMore ? [...prev, ...(data.rows ?? [])] : (data.rows ?? []));
      setNextCursor(data.nextCursor ?? null);
      if (data.summary) setSummary(data.summary);
    } catch {
      if (!isMore) setRows([]);
    } finally {
      if (isMore) setLoadingMore(false); else setLoading(false);
    }
  }, [category, level]);

  // 필터 변경 시 새로 로드
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // 자동 새로고침 (모니터링)
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchLogs(), 10000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs]);

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px', color: '#0F172A' }}>로그 / 모니터링</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>에러·네트워크·감사·시스템 로그 (최근 24시간 요약)</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
          10초 자동 새로고침
        </label>
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: '24h 전체', value: summary.total, color: '#0F172A' },
            { label: '에러', value: summary.errorLevel, color: '#B91C1C' },
            { label: '경고', value: summary.warnLevel, color: '#B45309' },
            { label: '네트워크', value: summary.network, color: '#1D4ED8' },
            { label: '감사', value: summary.audit, color: '#15803D' },
            { label: '시스템', value: summary.system, color: '#7E22CE' },
          ].map(c => (
            <div key={c.label} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px', fontWeight: 500 }}>{c.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: c.color, lineHeight: 1 }}>{c.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* 필터 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '3px' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: category === c.key ? 600 : 400, background: category === c.key ? '#3730a3' : 'transparent', color: category === c.key ? '#fff' : '#475569' }}>{c.label}</button>
          ))}
        </div>
        <select value={level} onChange={e => setLevel(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', color: '#475569', background: '#fff' }}>
          <option value="all">전체 레벨</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
          <option value="info">info</option>
          <option value="debug">debug</option>
        </select>
        <form onSubmit={e => { e.preventDefault(); fetchLogs(); }} style={{ display: 'flex', gap: '6px', flex: 1, minWidth: '220px' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="event / message 검색" style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }} />
          <button type="submit" style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0F172A', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>검색</button>
        </form>
        <button onClick={() => fetchLogs()} title="새로고침" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: '13px', cursor: 'pointer' }}>↻</button>
      </div>

      {/* 테이블 */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 70px 90px 70px 1fr', gap: '12px', padding: '10px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          <div>시각</div><div>레벨</div><div>카테고리</div><div>소스</div><div>이벤트 / 메시지</div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>로딩 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>로그가 없습니다.</div>
        ) : rows.map(r => (
          <div key={r.id}>
            <div onClick={() => setExpanded(expanded === r.id ? null : r.id)} style={{ display: 'grid', gridTemplateColumns: '130px 70px 90px 70px 1fr', gap: '12px', padding: '10px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12.5px', color: '#334155', cursor: 'pointer', alignItems: 'center' }}>
              <div style={{ color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(r.created_at)}</div>
              <div><Badge text={r.level} color={LEVEL_COLOR[r.level]} /></div>
              <div><Badge text={r.category} color={CAT_COLOR[r.category] ?? LEVEL_COLOR.debug} /></div>
              <div style={{ color: '#94A3B8', fontSize: '11.5px' }}>{r.source}</div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{r.event}</span>
                {r.message && <span style={{ color: '#64748B' }}> — {r.message}</span>}
              </div>
            </div>
            {expanded === r.id && (
              <div style={{ padding: '12px 16px 16px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', fontSize: '12px' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '10px', color: '#475569' }}>
                  <span><b style={{ color: '#94A3B8' }}>user_id:</b> {r.user_id ?? '—'}</span>
                  <span><b style={{ color: '#94A3B8' }}>tutorial_id:</b> {r.tutorial_id ?? '—'}</span>
                  <span style={{ wordBreak: 'break-all' }}><b style={{ color: '#94A3B8' }}>url:</b> {r.url ?? '—'}</span>
                </div>
                <pre style={{ margin: 0, padding: '12px', background: '#0F172A', color: '#E2E8F0', borderRadius: '8px', fontSize: '11.5px', overflow: 'auto', maxHeight: '300px' }}>{r.context ? JSON.stringify(r.context, null, 2) : '(context 없음)'}</pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {nextCursor && !loading && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button onClick={() => fetchLogs({ before: nextCursor })} disabled={loadingMore} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: '13px', cursor: loadingMore ? 'default' : 'pointer' }}>{loadingMore ? '불러오는 중...' : '더 보기'}</button>
        </div>
      )}
    </div>
  );
}

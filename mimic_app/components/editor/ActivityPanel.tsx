'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Clock } from 'lucide-react';

interface Actor { name: string | null; avatar_url: string | null; email: string | null; }
interface ActivityItem {
  id: string;
  action: string;
  step_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  actor: Actor | null;
  step: { step_number: number } | null;
}

interface ActivityPanelProps {
  tutorialId: string;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function actorName(a: Actor | null): string {
  if (!a) return '알 수 없음';
  return a.name || a.email?.split('@')[0] || '익명';
}

function describe(a: ActivityItem): string {
  const who = actorName(a.actor);
  const step = a.step ? `${a.step.step_number}단계` : '매뉴얼';
  const email = (a.meta?.email as string) ?? '';
  const role = a.meta?.role === 'editor' ? '편집' : '보기';
  switch (a.action) {
    case 'comment_added':   return `${who}님이 ${step}에 댓글을 남겼습니다`;
    case 'reply_added':     return `${who}님이 ${step} 댓글에 답글을 달았습니다`;
    case 'comment_resolved':return `${who}님이 ${step} 댓글을 해결했습니다`;
    case 'comment_reopened':return `${who}님이 ${step} 댓글을 다시 열었습니다`;
    case 'share_invited':   return `${who}님이 ${email}님을 ${role} 권한으로 초대했습니다`;
    case 'share_revoked':   return `${who}님이 ${email} 공유를 해제했습니다`;
    default:                return `${who}님의 활동`;
  }
}

function Avatar({ actor }: { actor: Actor | null }) {
  const name = actorName(actor);
  if (actor?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={actor.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#E5E7EB', color: '#4B5563', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function ActivityPanel({ tutorialId, onClose }: ActivityPanelProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tutorials/${tutorialId}/activity`);
      if (res.ok) {
        const { activity } = await res.json();
        setItems(activity ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [tutorialId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ width: '330px', flexShrink: 0, borderLeft: '1px solid #E5E7EB', background: '#FAFAFA', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'white', borderBottom: '1px solid #F0F0F2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <button onClick={onClose} title="닫기" style={{ width: '22px', height: '22px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', display: 'grid', placeItems: 'center' }}>
            <X size={16} />
          </button>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} /> 활동 로그
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12.5px', paddingTop: '20px' }}>불러오는 중...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12.5px', paddingTop: '36px' }}>아직 활동 내역이 없습니다</div>
        ) : (
          items.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start' }}>
              <Avatar actor={a.actor} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', color: '#374151', lineHeight: 1.5 }}>{describe(a)}</div>
                {typeof a.meta?.snippet === 'string' && a.meta.snippet && (
                  <div style={{ fontSize: '11.5px', color: '#9CA3AF', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>&ldquo;{a.meta.snippet as string}&rdquo;</div>
                )}
                <div style={{ fontSize: '10.5px', color: '#C4C9D4', marginTop: '2px' }}>{timeAgo(a.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

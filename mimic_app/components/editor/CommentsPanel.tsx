'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Send, Trash2, CornerDownRight, MessageSquare } from 'lucide-react';

interface CommentAuthor {
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface CommentItem {
  id: string;
  step_id: string | null;
  parent_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  author: CommentAuthor | null;
}

interface CommentsPanelProps {
  tutorialId: string;
  activeStepId: string | null;
  steps: { id: string; number: number }[];
  currentUserId: string | null;
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

function authorName(a: CommentAuthor | null): string {
  if (!a) return '알 수 없음';
  return a.name || a.email?.split('@')[0] || '익명';
}

function Avatar({ author }: { author: CommentAuthor | null }) {
  const name = authorName(author);
  if (author?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={author.avatar_url} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#EEF2FF', color: '#4F46E5', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function CommentsPanel({ tutorialId, activeStepId, steps, currentUserId, onClose }: CommentsPanelProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'step' | 'all'>(activeStepId ? 'step' : 'all');
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const composing = useRef(false);

  // 활성 스텝이 없어지면 전체 탭으로
  useEffect(() => { if (!activeStepId && scope === 'step') setScope('all'); }, [activeStepId, scope]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tutorials/${tutorialId}/comments`);
      if (res.ok) {
        const { comments } = await res.json();
        setComments(comments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [tutorialId]);

  useEffect(() => { load(); }, [load]);

  const scopeStepId = scope === 'step' ? activeStepId : null;

  const post = async (body: string, parentId: string | null) => {
    const text = body.trim();
    if (!text) return;
    const res = await fetch(`/api/tutorials/${tutorialId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text, step_id: scopeStepId, parent_id: parentId }),
    });
    if (res.ok) {
      const { comment } = await res.json();
      setComments(prev => [...prev, comment]);
    }
  };

  const handlePost = async () => {
    if (!draft.trim() || posting) return;
    setPosting(true);
    try { await post(draft, null); setDraft(''); }
    finally { setPosting(false); }
  };

  const handleReply = async (parentId: string) => {
    if (!replyDraft.trim()) return;
    await post(replyDraft, parentId);
    setReplyDraft('');
    setReplyTo(null);
  };

  const handleDelete = async (commentId: string) => {
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      // 삭제된 댓글 + 그에 달린 대댓글 제거
      setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId));
    }
  };

  // 현재 스코프의 최상위 댓글 + 각자의 대댓글
  const visible = comments.filter(c =>
    (scope === 'step' ? c.step_id === activeStepId : c.step_id === null)
  );
  const topLevel = visible.filter(c => !c.parent_id);
  const repliesOf = (id: string) => visible.filter(c => c.parent_id === id);

  const activeStepNumber = steps.find(s => s.id === activeStepId)?.number;

  const renderComment = (c: CommentItem, isReply: boolean) => {
    const mine = c.author_id === currentUserId;
    return (
      <div key={c.id} style={{ display: 'flex', gap: '8px', marginLeft: isReply ? '20px' : 0 }}>
        {isReply && <CornerDownRight size={13} style={{ color: '#D1D5DB', marginTop: '6px', flexShrink: 0 }} />}
        <Avatar author={c.author} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>{authorName(c.author)}</span>
            <span style={{ fontSize: '10.5px', color: '#9CA3AF' }}>{timeAgo(c.created_at)}</span>
          </div>
          <div style={{ fontSize: '12.5px', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '2px' }}>{c.body}</div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '3px' }}>
            {!isReply && (
              <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyDraft(''); }}
                style={{ fontSize: '11px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                답글
              </button>
            )}
            {mine && (
              <button onClick={() => handleDelete(c.id)}
                style={{ fontSize: '11px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                <Trash2 size={10} /> 삭제
              </button>
            )}
          </div>
          {replyTo === c.id && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <input
                value={replyDraft}
                autoFocus
                onChange={e => { if (!composing.current) setReplyDraft(e.target.value); }}
                onCompositionStart={() => { composing.current = true; }}
                onCompositionEnd={e => { composing.current = false; setReplyDraft(e.currentTarget.value); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !composing.current) { e.preventDefault(); handleReply(c.id); } }}
                placeholder="답글 입력..."
                style={{ flex: 1, fontSize: '12px', padding: '6px 9px', borderRadius: '7px', border: '1px solid #E5E7EB', outline: 'none' }}
              />
              <button onClick={() => handleReply(c.id)} disabled={!replyDraft.trim()}
                style={{ padding: '0 9px', borderRadius: '7px', border: 'none', background: replyDraft.trim() ? '#4F46E5' : '#E5E7EB', color: 'white', cursor: replyDraft.trim() ? 'pointer' : 'default', display: 'grid', placeItems: 'center' }}>
                <Send size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '320px', flexShrink: 0, borderLeft: '1px solid #E5E7EB', background: 'white', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 헤더 */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>
          <MessageSquare size={14} /> 댓글
        </div>
        <button onClick={onClose} style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#F3F4F6', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#6B7280' }}>
          <X size={13} />
        </button>
      </div>

      {/* 스코프 탭 */}
      <div style={{ display: 'flex', gap: '4px', padding: '8px 10px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        <button onClick={() => setScope('step')} disabled={!activeStepId}
          style={{ flex: 1, height: '30px', borderRadius: '7px', border: 'none', fontSize: '12px', fontWeight: scope === 'step' ? 600 : 400, cursor: activeStepId ? 'pointer' : 'not-allowed', background: scope === 'step' ? '#EEF2FF' : 'transparent', color: !activeStepId ? '#D1D5DB' : scope === 'step' ? '#4338ca' : '#6B7280' }}>
          {activeStepNumber ? `${activeStepNumber}단계` : '이 단계'}
        </button>
        <button onClick={() => setScope('all')}
          style={{ flex: 1, height: '30px', borderRadius: '7px', border: 'none', fontSize: '12px', fontWeight: scope === 'all' ? 600 : 400, cursor: 'pointer', background: scope === 'all' ? '#EEF2FF' : 'transparent', color: scope === 'all' ? '#4338ca' : '#6B7280' }}>
          매뉴얼 전체
        </button>
      </div>

      {/* 댓글 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12.5px', paddingTop: '20px' }}>불러오는 중...</div>
        ) : topLevel.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12.5px', paddingTop: '30px' }}>
            {scope === 'step' ? '이 단계에 댓글이 없습니다' : '아직 댓글이 없습니다'}<br />
            <span style={{ fontSize: '11.5px' }}>첫 의견을 남겨보세요</span>
          </div>
        ) : (
          topLevel.map(c => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {renderComment(c, false)}
              {repliesOf(c.id).map(r => renderComment(r, true))}
            </div>
          ))
        )}
      </div>

      {/* 입력 */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
          <textarea
            value={draft}
            onChange={e => { if (!composing.current) setDraft(e.target.value); }}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={e => { composing.current = false; setDraft(e.currentTarget.value); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !composing.current) { e.preventDefault(); handlePost(); } }}
            placeholder={scope === 'step' && activeStepNumber ? `${activeStepNumber}단계에 댓글...` : '매뉴얼 전체에 댓글...'}
            rows={2}
            style={{ flex: 1, fontSize: '12.5px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.4 }}
          />
          <button onClick={handlePost} disabled={!draft.trim() || posting}
            style={{ width: '34px', height: '34px', borderRadius: '8px', border: 'none', background: draft.trim() && !posting ? 'linear-gradient(135deg, #3730a3, #6d28d9)' : '#E5E7EB', color: 'white', cursor: draft.trim() && !posting ? 'pointer' : 'default', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

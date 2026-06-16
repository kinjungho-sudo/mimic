'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Send, Check, CheckCircle2, MoreHorizontal, MessageSquarePlus } from 'lucide-react';

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
  resolved_at: string | null;
  author: CommentAuthor | null;
}

interface CommentsPanelProps {
  tutorialId: string;
  activeStepId: string | null;
  steps: { id: string; number: number }[];
  currentUserId: string | null;
  onClose: () => void;
  onJumpToStep?: (stepId: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '1분 미만 전';
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

function Avatar({ author, size = 28 }: { author: CommentAuthor | null; size?: number }) {
  const name = authorName(author);
  if (author?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={author.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#E5E7EB', color: '#4B5563', display: 'grid', placeItems: 'center', fontSize: size * 0.42, fontWeight: 700, flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function CommentsPanel({ tutorialId, activeStepId, steps, currentUserId, onClose, onJumpToStep }: CommentsPanelProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const imeOn = useRef(false);

  const stepNumberOf = useCallback((stepId: string | null) => {
    if (!stepId) return null;
    return steps.find(s => s.id === stepId)?.number ?? null;
  }, [steps]);

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

  const post = async (body: string, parentId: string | null, stepId: string | null) => {
    const text = body.trim();
    if (!text) return;
    const res = await fetch(`/api/tutorials/${tutorialId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text, step_id: stepId, parent_id: parentId }),
    });
    if (res.ok) {
      const { comment } = await res.json();
      setComments(prev => [...prev, comment]);
    }
  };

  const handleAdd = async () => {
    if (!draft.trim() || posting || !activeStepId) return;
    setPosting(true);
    try { await post(draft, null, activeStepId); setDraft(''); setComposing(false); }
    finally { setPosting(false); }
  };

  const handleReply = async (parent: CommentItem) => {
    if (!replyDraft.trim()) return;
    await post(replyDraft, parent.id, parent.step_id);
    setReplyDraft('');
    setReplyTo(null);
  };

  const handleResolve = async (c: CommentItem, resolved: boolean) => {
    const res = await fetch(`/api/comments/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    });
    if (res.ok) {
      const nowIso = new Date().toISOString();
      setComments(prev => prev.map(x => x.id === c.id ? { ...x, resolved_at: resolved ? nowIso : null } : x));
    }
  };

  const handleDelete = async (commentId: string) => {
    setMenuOpen(null);
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId));
    }
  };

  const repliesOf = (id: string) => comments.filter(c => c.parent_id === id);
  const topLevel = comments.filter(c => !c.parent_id && (tab === 'open' ? !c.resolved_at : !!c.resolved_at));
  const openCount = comments.filter(c => !c.parent_id && !c.resolved_at).length;
  const resolvedCount = comments.filter(c => !c.parent_id && !!c.resolved_at).length;
  const activeStepNumber = stepNumberOf(activeStepId);

  const tabBtn = (key: 'open' | 'resolved', label: string, count: number) => (
    <button onClick={() => setTab(key)}
      style={{
        flex: 1, height: '34px', borderRadius: '8px', fontSize: '12.5px', cursor: 'pointer',
        fontWeight: tab === key ? 600 : 500,
        border: tab === key ? '1px solid #C7D2FE' : '1px solid transparent',
        background: tab === key ? 'white' : 'transparent',
        color: tab === key ? '#4338ca' : '#6B7280',
        boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
      }}>
      {label}{count > 0 ? ` ${count}` : ''}
    </button>
  );

  const replyInput = (parent: CommentItem) => (
    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
      <input
        value={replyDraft}
        autoFocus
        onChange={e => setReplyDraft(e.target.value)}
        onCompositionStart={() => { imeOn.current = true; }}
        onCompositionEnd={() => { imeOn.current = false; }}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !imeOn.current) { e.preventDefault(); handleReply(parent); } }}
        placeholder="답글 입력..."
        style={{ flex: 1, fontSize: '12px', padding: '7px 10px', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none' }}
      />
      <button onClick={() => handleReply(parent)} disabled={!replyDraft.trim()}
        style={{ padding: '0 10px', borderRadius: '8px', border: 'none', background: replyDraft.trim() ? '#4F46E5' : '#E5E7EB', color: 'white', cursor: replyDraft.trim() ? 'pointer' : 'default', display: 'grid', placeItems: 'center' }}>
        <Send size={13} />
      </button>
    </div>
  );

  return (
    <div style={{ width: '330px', flexShrink: 0, borderLeft: '1px solid #E5E7EB', background: '#FAFAFA', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 헤더 */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'white', borderBottom: '1px solid #F0F0F2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <button onClick={onClose} title="닫기" style={{ width: '22px', height: '22px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', display: 'grid', placeItems: 'center' }}>
            <X size={16} />
          </button>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>댓글</span>
        </div>
        <button
          onClick={() => { setComposing(v => !v); setDraft(''); }}
          disabled={!activeStepId}
          title={activeStepId ? '현재 단계에 댓글 추가' : '먼저 단계를 선택하세요'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '30px', padding: '0 12px', borderRadius: '8px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: activeStepId ? 'pointer' : 'not-allowed', background: activeStepId ? '#4F46E5' : '#E5E7EB', color: 'white' }}>
          <MessageSquarePlus size={14} /> 추가
        </button>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', background: '#F1F1F4', margin: '10px 12px 0', borderRadius: '10px', flexShrink: 0 }}>
        {tabBtn('open', '오픈', openCount)}
        {tabBtn('resolved', '해결 완료', resolvedCount)}
      </div>

      {/* 작성 박스 (추가 토글) */}
      {composing && (
        <div style={{ margin: '10px 12px 0', padding: '10px', background: 'white', border: '1px solid #C7D2FE', borderRadius: '12px', flexShrink: 0 }}>
          <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '6px' }}>
            {activeStepNumber ? `${activeStepNumber}단계에 댓글` : '이 단계에 댓글'}
          </div>
          <textarea
            value={draft}
            autoFocus
            rows={3}
            onChange={e => setDraft(e.target.value)}
            onCompositionStart={() => { imeOn.current = true; }}
            onCompositionEnd={() => { imeOn.current = false; }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !imeOn.current) { e.preventDefault(); handleAdd(); } }}
            placeholder="의견을 남겨보세요..."
            style={{ width: '100%', fontSize: '12.5px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.45, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px' }}>
            <button onClick={() => { setComposing(false); setDraft(''); }}
              style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', fontSize: '12px', cursor: 'pointer' }}>취소</button>
            <button onClick={handleAdd} disabled={!draft.trim() || posting}
              style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', background: draft.trim() && !posting ? 'linear-gradient(135deg, #3730a3, #6d28d9)' : '#E5E7EB', color: 'white', fontSize: '12px', fontWeight: 600, cursor: draft.trim() && !posting ? 'pointer' : 'default' }}>
              댓글 남기기
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
        onClick={() => menuOpen && setMenuOpen(null)}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12.5px', paddingTop: '20px' }}>불러오는 중...</div>
        ) : topLevel.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12.5px', paddingTop: '36px' }}>
            {tab === 'open' ? '열린 댓글이 없습니다' : '해결된 댓글이 없습니다'}
          </div>
        ) : (
          topLevel.map(c => {
            const stepNo = stepNumberOf(c.step_id);
            const mine = c.author_id === currentUserId;
            const resolved = !!c.resolved_at;
            return (
              <div key={c.id} style={{ background: 'white', border: '1px solid #E8E8EC', borderRadius: '12px', padding: '12px', boxShadow: '0 1px 2px rgba(17,24,39,0.04)' }}>
                {/* 카드 헤더 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <Avatar author={c.author} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{authorName(c.author)}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '1px' }}>{timeAgo(c.created_at)}</div>
                  </div>
                  {/* 해결 토글 */}
                  <button onClick={() => handleResolve(c, !resolved)} title={resolved ? '다시 열기' : '해결로 표시'}
                    style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: resolved ? '#10B981' : '#C4C9D4' }}>
                    {resolved ? <CheckCircle2 size={17} /> : <Check size={16} />}
                  </button>
                  {/* ... 메뉴 */}
                  <div style={{ position: 'relative' }}>
                    <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === c.id ? null : c.id); }}
                      style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#9CA3AF' }}>
                      <MoreHorizontal size={16} />
                    </button>
                    {menuOpen === c.id && (
                      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '26px', right: 0, zIndex: 50, background: 'white', border: '1px solid #E5E7EB', borderRadius: '9px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: '4px', minWidth: '120px' }}>
                        <button onClick={() => handleResolve(c, !resolved)}
                          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '7px', padding: '7px 9px', border: 'none', background: 'transparent', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#374151', textAlign: 'left' }}>
                          {resolved ? '다시 열기' : '해결로 표시'}
                        </button>
                        {mine && (
                          <button onClick={() => handleDelete(c.id)}
                            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '7px', padding: '7px 9px', border: 'none', background: 'transparent', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#DC2626', textAlign: 'left' }}>
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 스텝 배지 */}
                {stepNo != null && (
                  <button onClick={() => onJumpToStep?.(c.step_id!)}
                    style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', border: '1px solid #E0E7FF', background: '#EEF2FF', color: '#4338ca', fontSize: '10.5px', fontWeight: 600, cursor: onJumpToStep ? 'pointer' : 'default' }}>
                    {stepNo}단계
                  </button>
                )}

                {/* 본문 */}
                <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '8px' }}>{c.body}</div>

                {/* 대댓글 */}
                {repliesOf(c.id).map(r => (
                  <div key={r.id} style={{ display: 'flex', gap: '7px', marginTop: '10px', paddingLeft: '8px', borderLeft: '2px solid #F0F0F2' }}>
                    <Avatar author={r.author} size={22} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{authorName(r.author)}</span>
                        <span style={{ fontSize: '12px', color: '#6B7280' }}>{timeAgo(r.created_at)}</span>
                        {r.author_id === currentUserId && (
                          <button onClick={() => handleDelete(r.id)} style={{ fontSize: '11px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 'auto' }}>삭제</button>
                        )}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '2px' }}>{r.body}</div>
                    </div>
                  </div>
                ))}

                {/* 답글 달기 */}
                {replyTo === c.id ? replyInput(c) : (
                  <button onClick={() => { setReplyTo(c.id); setReplyDraft(''); }}
                    style={{ width: '100%', marginTop: '10px', padding: '7px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', color: '#4F46E5', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    답글 달기
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

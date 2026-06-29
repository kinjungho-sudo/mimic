'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Minus, Send, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  related?: { id: string; label: string }[];
}

interface QuickQ { id: string; label: string }

type ContactCategory = '일반 문의' | '버그 신고' | '기능 요청';

// 마크다운 링크 [text](url) 와 **bold** 렌더링
function renderText(text: string) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        const segments: React.ReactNode[] = [];
        const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
        let last = 0;
        let m;
        while ((m = regex.exec(line)) !== null) {
          if (m.index > last) segments.push(line.slice(last, m.index));
          if (m[1] && m[2]) {
            const href = m[2].startsWith('/') ? m[2] : m[2];
            segments.push(
              <a key={m.index} href={href} target={href.startsWith('http') ? '_blank' : '_self'}
                rel="noopener noreferrer"
                style={{ color: '#3730a3', textDecoration: 'underline' }}>
                {m[1]}
              </a>
            );
          } else if (m[3]) {
            segments.push(<strong key={m.index}>{m[3]}</strong>);
          }
          last = m.index + m[0].length;
        }
        if (last < line.length) segments.push(line.slice(last));
        return (
          <span key={li}>
            {segments}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

export function AgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 문의 모드
  const [contactMode, setContactMode] = useState(false);
  const [contactCategory, setContactCategory] = useState<ContactCategory>('일반 문의');
  const [contactMsg, setContactMsg] = useState('');
  const [contactSending, setContactSending] = useState(false);
  const [contactResult, setContactResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    }).catch(() => {});
  }, []);

  const handleContactSend = async () => {
    if (!contactMsg.trim() || contactSending) return;
    setContactSending(true);
    setContactResult(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: contactMsg.trim(),
          category: contactCategory,
          userEmail: userEmail ?? undefined,
        }),
      });
      if (res.ok) {
        setContactResult({ ok: true, msg: '문의가 접수되었어요.' });
        setContactMsg('');
      } else {
        setContactResult({ ok: false, msg: '전송에 실패했어요. 다시 시도해주세요.' });
      }
    } catch {
      setContactResult({ ok: false, msg: '네트워크 오류가 발생했어요.' });
    } finally {
      setContactSending(false);
    }
  };

  // 초기 로드: FAQ 목록 + 웰컴 메시지
  useEffect(() => {
    fetch('/api/agent/chat')
      .then(r => r.json())
      .then(data => {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          text: '안녕하세요! MIMIC 도움말 봇입니다. 자주 묻는 질문을 고르거나 궁금한 점을 입력해주세요.',
          related: (data.quickQuestions ?? []).slice(0, 5),
        }]);
      })
      .catch(() => {
        setMessages([{ id: 'welcome', role: 'assistant', text: '안녕하세요! MIMIC 도움말 봇입니다. 궁금한 점을 입력해주세요.' }]);
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const ask = useCallback(async (query: string, faqId?: string) => {
    if (isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', text: '' }]);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, faqId }),
      });
      const data = await res.json() as { answer: string; related: QuickQ[] };

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, text: data.answer, related: data.related }
          : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, text: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
          : m
      ));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    ask(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── 토글 버튼 ──
  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} title="도움말 열기"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9000,
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #3730a3, #6d28d9)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(55,48,163,0.4)',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <Bot size={22} color="white" />
      </button>
    );
  }

  // ── 최소화 ──
  if (isMinimized) {
    return (
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 9000,
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'white', borderRadius: '999px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: '8px 16px 8px 10px', border: '1px solid #E5E7EB',
      }}>
        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', display: 'grid', placeItems: 'center' }}>
          <Bot size={15} color="white" />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>도움말 봇</span>
        <button onClick={() => setIsMinimized(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', marginLeft: '4px', fontSize: '13px' }}>열기</button>
        <button onClick={() => { setIsOpen(false); setIsMinimized(false); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}><X size={14} /></button>
      </div>
    );
  }

  const CATEGORIES: ContactCategory[] = ['일반 문의', '버그 신고', '기능 요청'];
  const categoryPlaceholder: Record<ContactCategory, string> = {
    '일반 문의': '궁금한 점이나 의견을 자유롭게 적어주세요.',
    '버그 신고': '어떤 화면에서 어떤 문제가 발생했는지 자세히 적어주세요. (예: 스텝 저장 시 오류 발생)',
    '기능 요청': '어떤 기능이 필요하신지 구체적으로 적어주세요. (사용 상황 포함)',
  };

  // ── 풀 패널 ──
  return (
    <div style={{
      position: 'fixed', bottom: '90px', right: '24px', zIndex: 9000,
      width: 'min(360px, calc(100vw - 32px))', height: 'min(540px, calc(100vh - 120px))',
      background: 'white', borderRadius: '16px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 14px', flexShrink: 0,
        background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white',
      }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Bot size={15} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>도움말 봇</div>
          <div style={{ fontSize: '11px', opacity: 0.78, marginTop: '1px' }}>FAQ 기반 빠른 답변</div>
        </div>
        <button onClick={() => { setContactMode(true); setContactResult(null); }}
          title="문의하기"
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', borderRadius: '6px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
          <Mail size={12} /> 문의하기
        </button>
        <button onClick={() => setIsMinimized(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', borderRadius: '6px', padding: '4px 6px', display: 'grid', placeItems: 'center' }}>
          <Minus size={13} />
        </button>
        <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', borderRadius: '6px', padding: '4px 6px', display: 'grid', placeItems: 'center' }}>
          <X size={13} />
        </button>
      </div>

      {/* 문의 모드 */}
      {contactMode && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '10px', overflowY: 'auto' }}>
          <button onClick={() => { setContactMode(false); setContactResult(null); setContactMsg(''); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '12.5px', padding: 0, alignSelf: 'flex-start' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            FAQ로 돌아가기
          </button>

          {contactResult?.ok ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div style={{ fontSize: '36px' }}>✅</div>
              <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#15803D', textAlign: 'center' }}>문의가 접수되었어요!</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#4B5563', lineHeight: 1.7, textAlign: 'center' }}>
                답변은 <b>1~3 영업일</b> 내에 이메일로 드립니다.<br />
                업무 시간: <b>평일 09:00 ~ 18:00</b>
              </p>
              <button onClick={() => { setContactResult(null); setContactMode(false); }} style={{ marginTop: '8px', padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#3730a3', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                확인
              </button>
            </div>
          ) : (
            <>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#111827' }}>문의하기</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', lineHeight: 1.5 }}>문의 유형을 선택하고 내용을 입력해주세요.</p>
              </div>

              {/* 카테고리 선택 */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setContactCategory(cat)}
                    style={{ flex: 1, padding: '6px 4px', borderRadius: '8px', border: `1.5px solid ${contactCategory === cat ? '#3730a3' : '#E5E7EB'}`, background: contactCategory === cat ? '#EEF2FF' : 'white', color: contactCategory === cat ? '#3730a3' : '#6B7280', fontSize: '11.5px', fontWeight: contactCategory === cat ? 700 : 400, cursor: 'pointer', transition: 'all 0.12s' }}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* 이메일 표시 */}
              {userEmail && (
                <div style={{ padding: '7px 10px', borderRadius: '7px', background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: '12px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={12} style={{ flexShrink: 0 }} />
                  <span>{userEmail} 으로 답변드립니다</span>
                </div>
              )}

              <textarea
                value={contactMsg}
                onChange={e => setContactMsg(e.target.value)}
                placeholder={categoryPlaceholder[contactCategory]}
                rows={6}
                style={{ resize: 'none', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', lineHeight: 1.6, color: '#111827' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#3730a3'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
              />
              {contactResult && <p style={{ margin: 0, fontSize: '12px', color: '#EF4444' }}>✕ {contactResult.msg}</p>}
              <button
                onClick={handleContactSend}
                disabled={!contactMsg.trim() || contactSending}
                style={{ width: '100%', height: '40px', borderRadius: '10px', border: 'none', background: contactMsg.trim() && !contactSending ? 'linear-gradient(135deg,#3730a3,#6d28d9)' : '#E5E7EB', color: contactMsg.trim() && !contactSending ? 'white' : '#9CA3AF', fontSize: '13.5px', fontWeight: 700, cursor: contactMsg.trim() && !contactSending ? 'pointer' : 'not-allowed' }}>
                {contactSending ? '전송 중...' : '문의 보내기'}
              </button>
            </>
          )}
        </div>
      )}

      {/* 메시지 영역 */}
      {!contactMode && <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '8px' }}>
            <div style={{
              maxWidth: '90%', padding: '9px 12px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? 'linear-gradient(135deg, #3730a3, #6d28d9)' : '#F3F4F6',
              color: msg.role === 'user' ? 'white' : '#111827',
              fontSize: '13px', lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.text
                ? (msg.role === 'assistant' ? renderText(msg.text) : msg.text)
                : (isLoading && msg.role === 'assistant'
                  ? <span style={{ opacity: 0.5 }}>답변 찾는 중...</span>
                  : null)}
            </div>

            {msg.role === 'assistant' && msg.related && msg.related.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '90%' }}>
                {msg.related.map(q => (
                  <button key={q.id} onClick={() => ask(q.label, q.id)}
                    style={{
                      padding: '4px 10px', borderRadius: '999px',
                      border: '1px solid #a5b4fc', background: '#EEF2FF',
                      color: '#3730a3', fontSize: '11.5px', fontWeight: 500,
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e0e7ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#EEF2FF'; }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex' }}>
            <div style={{ padding: '9px 14px', borderRadius: '14px 14px 14px 4px', background: '#F3F4F6', display: 'flex', gap: '3px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#9CA3AF', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`, display: 'block' }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>}

      {/* 입력 영역 */}
      {!contactMode && (
        <div style={{ flexShrink: 0, borderTop: '1px solid #F3F4F6', padding: '8px 12px 12px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="직접 질문을 입력하세요..."
            rows={1}
            style={{
              flex: 1, resize: 'none', border: '1px solid #E5E7EB', borderRadius: '10px',
              padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit',
              outline: 'none', lineHeight: 1.5, maxHeight: '72px', overflowY: 'auto',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#3730a3'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
          />
          <button onClick={handleSend} disabled={!input.trim() || isLoading}
            style={{
              width: '36px', height: '36px', borderRadius: '10px', border: 'none',
              background: input.trim() && !isLoading ? 'linear-gradient(135deg, #3730a3, #6d28d9)' : '#E5E7EB',
              color: input.trim() && !isLoading ? 'white' : '#9CA3AF',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}
          >
            <Send size={15} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)} }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

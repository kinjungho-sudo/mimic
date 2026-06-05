'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Minus, Send, HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  related?: { id: string; label: string }[];
}

interface QuickQ { id: string; label: string }

// 마크다운 링크 [text](url) 와 **bold** 렌더링
function renderText(text: string) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        // 링크와 볼드 파싱
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
  const [quickQuestions, setQuickQuestions] = useState<QuickQ[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 초기 로드: FAQ 목록 + 웰컴 메시지
  useEffect(() => {
    fetch('/api/agent/chat')
      .then(r => r.json())
      .then(data => {
        setQuickQuestions(data.quickQuestions ?? []);
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          text: '안녕하세요! MIMIC에 대해 궁금한 점을 아래에서 선택하거나 직접 입력해주세요.',
          related: (data.quickQuestions ?? []).slice(0, 5),
        }]);
      })
      .catch(() => {
        setMessages([{ id: 'welcome', role: 'assistant', text: '안녕하세요! MIMIC에 대해 궁금한 점을 입력해주세요.' }]);
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
      <button onClick={() => setIsOpen(true)} title="문의하기"
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
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>문의하기</span>
        <button onClick={() => setIsMinimized(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', marginLeft: '4px', fontSize: '13px' }}>열기</button>
        <button onClick={() => { setIsOpen(false); setIsMinimized(false); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}><X size={14} /></button>
      </div>
    );
  }

  // ── 풀 패널 ──
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9000,
      width: '360px', height: '540px',
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
          <div style={{ fontSize: '13px', fontWeight: 700 }}>MIMIC 도움말</div>
          <div style={{ fontSize: '10.5px', opacity: 0.75 }}>자주 묻는 질문 · 서비스 안내</div>
        </div>
        <a href="/help" target="_blank" rel="noopener noreferrer"
          title="도움말 전체 보기"
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', borderRadius: '6px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', textDecoration: 'none' }}>
          <HelpCircle size={12} /> 전체 도움말
        </a>
        <button onClick={() => setIsMinimized(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', borderRadius: '6px', padding: '4px 6px', display: 'grid', placeItems: 'center' }}>
          <Minus size={13} />
        </button>
        <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', borderRadius: '6px', padding: '4px 6px', display: 'grid', placeItems: 'center' }}>
          <X size={13} />
        </button>
      </div>

      {/* 메시지 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '8px' }}>
            {/* 말풍선 */}
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

            {/* 연관 질문 칩 */}
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

        {/* 로딩 */}
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
      </div>

      {/* 자주 묻는 질문 가로 스크롤 */}
      {quickQuestions.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: '1px solid #F3F4F6', padding: '8px 12px 6px' }}>
          <div style={{ fontSize: '10.5px', color: '#9CA3AF', marginBottom: '6px', fontWeight: 500 }}>자주 묻는 질문</div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}
            className="hide-scrollbar">
            {quickQuestions.map(q => (
              <button key={q.id} onClick={() => ask(q.label, q.id)}
                style={{
                  padding: '4px 10px', borderRadius: '999px', flexShrink: 0,
                  border: '1px solid #E5E7EB', background: 'white',
                  color: '#374151', fontSize: '11.5px', cursor: 'pointer',
                  transition: 'all 0.12s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#a5b4fc'; e.currentTarget.style.color = '#3730a3'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151'; }}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 입력 */}
      <div style={{ flexShrink: 0, padding: '8px 12px 10px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
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

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)} }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

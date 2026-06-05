'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Minus, Send } from 'lucide-react';

type Role = 'user' | 'assistant';

interface Message {
  id: string;
  role: Role;
  text: string;
}

type ApiMessage = { role: Role; content: string };

export function AgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', text: '안녕하세요! MIMIC에 대해 궁금한 점을 물어보세요.' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const history: ApiMessage[] = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.text }));
    history.push({ role: 'user', content: text });

    const assistantId = (Date.now() + 1).toString();
    let assistantText = '';

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) throw new Error('API 오류');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', text: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text') {
              assistantText += event.text;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, text: assistantText } : m
              ));
            }
          } catch { /* 무시 */ }
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, text: '오류가 발생했습니다. 다시 시도해주세요.' } : m
      ));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // 토글 버튼
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="문의하기"
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

  // 최소화
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

  // 풀 패널
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9000,
      width: '340px', height: '480px',
      background: 'white', borderRadius: '16px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 14px', flexShrink: 0,
        background: 'linear-gradient(135deg, #3730a3, #6d28d9)',
        color: 'white',
      }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Bot size={15} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>MIMIC 문의</div>
          <div style={{ fontSize: '10.5px', opacity: 0.75 }}>서비스 안내 · 고객 지원</div>
        </div>
        <button onClick={() => setIsMinimized(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', borderRadius: '6px', padding: '4px 6px', display: 'grid', placeItems: 'center' }}>
          <Minus size={13} />
        </button>
        <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', borderRadius: '6px', padding: '4px 6px', display: 'grid', placeItems: 'center' }}>
          <X size={13} />
        </button>
      </div>

      {/* 메시지 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '9px 12px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? 'linear-gradient(135deg, #3730a3, #6d28d9)' : '#F3F4F6',
              color: msg.role === 'user' ? 'white' : '#111827',
              fontSize: '13px', lineHeight: 1.55,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.text || (isLoading && msg.role === 'assistant'
                ? <span style={{ opacity: 0.5 }}>생각 중...</span>
                : null)}
            </div>
          </div>
        ))}
        {isLoading && !messages.find(m => m.role === 'assistant' && !m.text) && (
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

      {/* 입력 */}
      <div style={{ flexShrink: 0, padding: '10px 12px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="궁금한 점을 입력하세요..."
          rows={1}
          style={{
            flex: 1, resize: 'none', border: '1px solid #E5E7EB', borderRadius: '10px',
            padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit',
            outline: 'none', lineHeight: 1.5, maxHeight: '80px', overflowY: 'auto',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#3730a3'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
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

      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)} }`}</style>
    </div>
  );
}

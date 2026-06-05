'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Minus, Send, ExternalLink, MessageCircle, BookOpen, Zap } from 'lucide-react';
import type { ChatMode } from '@/app/api/agent/chat/route';

// ── Types ──────────────────────────────────────────────────

type Role = 'user' | 'assistant';

interface GuideEvent {
  guide_url: string;
  page_url: string;
  token: string;
  start_step: number;
}

interface Message {
  id: string;
  role: Role;
  text: string;
  guide?: GuideEvent;
}

type ApiMessage = { role: Role; content: string };

// ── 모드 설정 ──────────────────────────────────────────────

const MODE_CONFIG: Record<ChatMode, {
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  welcome: string;
  placeholder: string;
}> = {
  inquiry: {
    label: '문의',
    subtitle: '서비스 문의 · 고객 지원',
    icon: <MessageCircle size={14} />,
    color: '#0891b2',
    welcome: '안녕하세요! MIMIC 서비스에 대해 궁금한 점을 물어보세요.',
    placeholder: '문의 내용을 입력하세요...',
  },
  guide: {
    label: 'Guide Me',
    subtitle: '매뉴얼 단계별 안내',
    icon: <BookOpen size={14} />,
    color: '#4f46e5',
    welcome: '안녕하세요! 어떤 업무를 진행하고 싶으신가요? 매뉴얼을 찾아 단계별로 안내해드릴게요.',
    placeholder: '실행할 업무를 입력하세요...',
  },
  automation: {
    label: '자동화',
    subtitle: 'AI 워크플로우 · BETA',
    icon: <Zap size={14} />,
    color: '#7c3aed',
    welcome: '안녕하세요! AI 자동화 어시스턴트입니다. 현재 Guide Me 연동까지 지원합니다.',
    placeholder: '자동화할 작업을 입력하세요...',
  },
};

// ── Component ──────────────────────────────────────────────

export function AgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mode, setMode] = useState<ChatMode>('guide');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTool, setLoadingTool] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 모드 변경 시 대화 초기화 + 웰컴 메시지 갱신
  const handleModeChange = useCallback((newMode: ChatMode) => {
    setMode(newMode);
    setMessages([{
      id: 'welcome-' + newMode,
      role: 'assistant',
      text: MODE_CONFIG[newMode].welcome,
    }]);
    setInput('');
  }, []);

  // 초기 웰컴 메시지
  useEffect(() => {
    setMessages([{ id: 'welcome-guide', role: 'assistant', text: MODE_CONFIG.guide.welcome }]);
  }, []);

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
    setLoadingTool(null);

    const history: ApiMessage[] = messages
      .filter(m => !m.id.startsWith('welcome'))
      .map(m => ({ role: m.role, content: m.text }));
    history.push({ role: 'user', content: text });

    const assistantId = (Date.now() + 1).toString();
    let assistantText = '';

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, mode }),
      });

      if (!res.ok || !res.body) throw new Error('API 오류');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', text: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text') {
              assistantText += event.text;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, text: assistantText } : m
              ));
            } else if (event.type === 'tool_start') {
              const toolLabel: Record<string, string> = {
                search_tutorial: '매뉴얼 검색 중...',
                get_tutorial_steps: '단계 확인 중...',
                open_guide_me: 'Guide Me 준비 중...',
              };
              setLoadingTool(toolLabel[event.tool] ?? '처리 중...');
            } else if (event.type === 'guide_me') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, guide: event as GuideEvent } : m
              ));
            } else if (event.type === 'done') {
              setLoadingTool(null);
            }
          } catch { /* 무시 */ }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, text: '오류가 발생했습니다. 다시 시도해주세요.' } : m
      ));
      console.error(err);
    } finally {
      setIsLoading(false);
      setLoadingTool(null);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages, mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const cfg = MODE_CONFIG[mode];

  // ── 토글 버튼 ──
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9000,
          width: '52px', height: '52px', borderRadius: '50%',
          background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        title="AI 어시스턴트 열기"
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
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Bot size={16} color="white" />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>AI 어시스턴트</span>
        <button onClick={() => setIsMinimized(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', padding: '2px', marginLeft: '4px' }}>
          <ExternalLink size={14} />
        </button>
        <button onClick={() => { setIsOpen(false); setIsMinimized(false); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', padding: '2px' }}>
          <X size={14} />
        </button>
      </div>
    );
  }

  // ── 풀 패널 ──
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9000,
      width: '360px', height: '520px',
      background: 'white', borderRadius: '16px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 14px', flexShrink: 0,
        background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`,
        color: 'white',
      }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Bot size={15} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>AI 어시스턴트</div>
          <div style={{ fontSize: '10.5px', opacity: 0.8 }}>{cfg.subtitle}</div>
        </div>
        <button onClick={() => setIsMinimized(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', borderRadius: '6px', padding: '4px 6px', display: 'grid', placeItems: 'center' }}>
          <Minus size={13} />
        </button>
        <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', borderRadius: '6px', padding: '4px 6px', display: 'grid', placeItems: 'center' }}>
          <X size={13} />
        </button>
      </div>

      {/* 모드 탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', flexShrink: 0, background: '#FAFAFA' }}>
        {(Object.keys(MODE_CONFIG) as ChatMode[]).map(m => {
          const mc = MODE_CONFIG[m];
          const isActive = mode === m;
          return (
            <button key={m} onClick={() => handleModeChange(m)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '4px', padding: '7px 4px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: '11.5px', fontWeight: isActive ? 700 : 400,
                color: isActive ? mc.color : '#9CA3AF',
                borderBottom: isActive ? `2px solid ${mc.color}` : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
              {mc.icon}
              {mc.label}
              {m === 'automation' && (
                <span style={{ fontSize: '9px', padding: '1px 4px', background: isActive ? mc.color : '#E5E7EB', color: isActive ? 'white' : '#9CA3AF', borderRadius: '3px', fontWeight: 700 }}>
                  BETA
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 메시지 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '6px' }}>
            <div style={{
              maxWidth: '85%', padding: '9px 12px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` : '#F3F4F6',
              color: msg.role === 'user' ? 'white' : '#111827',
              fontSize: '13px', lineHeight: 1.55,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.text || (isLoading && msg.role === 'assistant'
                ? <span style={{ opacity: 0.6 }}>{loadingTool ?? '생각 중...'}</span>
                : null)}
            </div>
            {msg.guide && (
              <button
                onClick={() => window.open(msg.guide!.guide_url, '_blank')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px',
                  background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`,
                  color: 'white', border: 'none', cursor: 'pointer',
                  fontSize: '12.5px', fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}>
                <ExternalLink size={13} />
                Guide Me 시작하기
              </button>
            )}
          </div>
        ))}

        {isLoading && !messages.find(m => m.role === 'assistant' && !m.text) && (
          <div style={{ display: 'flex' }}>
            <div style={{ padding: '9px 14px', borderRadius: '14px 14px 14px 4px', background: '#F3F4F6', fontSize: '13px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'flex', gap: '3px' }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#9CA3AF', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </span>
              {loadingTool && <span>{loadingTool}</span>}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      <div style={{ flexShrink: 0, padding: '10px 12px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={cfg.placeholder}
          rows={1}
          style={{
            flex: 1, resize: 'none', border: '1px solid #E5E7EB', borderRadius: '10px',
            padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit',
            outline: 'none', lineHeight: 1.5, maxHeight: '80px', overflowY: 'auto',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = cfg.color; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          style={{
            width: '36px', height: '36px', borderRadius: '10px', border: 'none',
            background: input.trim() && !isLoading ? `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` : '#E5E7EB',
            color: input.trim() && !isLoading ? 'white' : '#9CA3AF',
            cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
            display: 'grid', placeItems: 'center', flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          <Send size={15} />
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

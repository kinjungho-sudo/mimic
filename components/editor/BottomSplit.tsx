'use client';

import { useState, useRef } from 'react';
import { Star, Play, Sparkles, Clock } from 'lucide-react';

const SUGGESTION_CHIPS = [
  '클릭된 요소에 노란색 하이라이트 박스를 치고, 빨간 화살표로 가리켜줘. 클릭 지점 주변에 빨간 원을 그리고 "클릭" 캡션을 달아줘. 하이라이트 박스, 화살표, "여기를 클릭하세요" 텍스트를 모두 배치해줘.',
  '클릭된 요소에 노란색 하이라이트 박스를 쳐줘.',
  '클릭 지점을 빨간 화살표로 가리켜줘.',
  '클릭된 요소 위에 "여기를 클릭하세요" 텍스트 캡션을 달아줘.',
  '클릭된 요소 주변에 빨간 원을 그려줘.',
];

interface BottomSplitProps {
  slideTitle: string;
  highlightCount: number;
  script: string;
  onAiApply: (prompt: string) => Promise<void>;
  onTtsPreview: () => Promise<void>;
  onAiRegenerate: () => Promise<void>;
  ttsDurationSec?: number;
}

export function BottomSplit({
  slideTitle,
  highlightCount,
  script,
  onAiApply,
  onTtsPreview,
  onAiRegenerate,
  ttsDurationSec = 8.2,
}: BottomSplitProps) {
  const [prompt, setPrompt] = useState('');
  const [applying, setApplying] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const ttsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleApply = async () => {
    setApplying(true);
    try { await onAiApply(prompt); } finally { setApplying(false); }
  };

  const handleTtsClick = async () => {
    if (ttsPlaying) return;
    setTtsPlaying(true);
    if (ttsTimerRef.current) clearTimeout(ttsTimerRef.current);
    await onTtsPreview();
    ttsTimerRef.current = setTimeout(() => setTtsPlaying(false), 4000);
  };

  return (
    <div
      style={{
        gridColumn: '2',
        gridRow: '3',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        borderTop: '1px solid #F3F4F6',
        background: 'white',
        minHeight: 0,
      }}
    >
      {/* Left — AI prompt panel */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Head */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderBottom: '1px solid #F3F4F6',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>
            AI 자동 적용
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 7px',
              background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)',
              color: 'white',
              borderRadius: '999px',
              fontSize: '9.5px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            <Star size={9} />
            POST /api/generate-annotations
          </span>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="어떻게 강조할지 입력하세요.&#10;예) 클릭된 요소에 노란색 하이라이트 박스를 치고, 클릭 지점을 빨간 화살표로 가리켜줘."
            style={{
              flex: 1,
              resize: 'none',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '10px 12px',
              fontFamily: 'inherit',
              fontSize: '12.5px',
              color: '#111827',
              outline: 'none',
              lineHeight: 1.55,
              background: 'white',
              transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
              minHeight: 0,
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#3730a3';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(55,48,163,0.10)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = '#E5E7EB';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />

          {/* Suggestion chips */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {SUGGESTION_CHIPS.map(chip => (
              <span
                key={chip}
                onClick={() => setPrompt(p => p + (p && !p.endsWith(' ') ? ' ' : '') + chip)}
                style={{
                  padding: '4px 10px',
                  background: '#FAFAFA',
                  border: '1px solid #E5E7EB',
                  borderRadius: '999px',
                  fontSize: '11px',
                  color: '#4B5563',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#3730a3';
                  e.currentTarget.style.color = '#3730a3';
                  e.currentTarget.style.background = 'white';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.color = '#4B5563';
                  e.currentTarget.style.background = '#FAFAFA';
                }}
              >
                {chip}
              </span>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', color: '#6B7280', lineHeight: 1.5 }}>
              대상 슬라이드:{' '}
              <code
                style={{
                  background: '#FAFAFA',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  fontSize: '10.5px',
                  color: '#4B5563',
                }}
              >
                {slideTitle}
              </code>
            </span>
            <button
              onClick={handleApply}
              disabled={applying}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '7px',
                background: applying ? 'rgba(55,48,163,0.5)' : 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)',
                color: 'white',
                fontSize: '12.5px',
                fontWeight: 500,
                boxShadow: '0 3px 8px rgba(55,48,163,0.25)',
                whiteSpace: 'nowrap',
                cursor: applying ? 'not-allowed' : 'pointer',
                border: 'none',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
              }}
              onMouseEnter={e => {
                if (!applying) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 14px rgba(55,48,163,0.32)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 3px 8px rgba(55,48,163,0.25)';
              }}
            >
              <Play size={12} />
              AI 자동 적용
            </button>
          </div>
        </div>
      </div>

      {/* Right — Script editor panel */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderLeft: '1px solid #F3F4F6',
        }}
      >
        {/* Head */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderBottom: '1px solid #F3F4F6',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>
            스크립트 (자막 + 음성)
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '11px',
              color: '#6B7280',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <Clock size={11} />
            TTS 예상 {ttsDurationSec}초 · 하이라이트 {highlightCount}개
          </span>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              flex: 1,
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              background: 'white',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            {/* Script preview with highlighted tokens — no dangerouslySetInnerHTML */}
            <div
              style={{
                flex: 1,
                padding: '12px 14px',
                fontSize: '13px',
                lineHeight: 1.7,
                color: '#4B5563',
                overflow: 'auto',
              }}
            >
              <ScriptPreview text={script} />
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingTop: '10px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                color: '#6B7280',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
              }}
            >
              <Clock size={11} />
              자동 저장
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              {/* TTS preview button */}
              <button
                onClick={handleTtsClick}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 12px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: `1px solid ${ttsPlaying ? 'rgba(109,40,217,0.25)' : '#E5E7EB'}`,
                  background: ttsPlaying ? 'rgba(109,40,217,0.10)' : 'white',
                  color: ttsPlaying ? '#6d28d9' : '#374151',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => {
                  if (!ttsPlaying) {
                    e.currentTarget.style.borderColor = '#3730a3';
                    e.currentTarget.style.color = '#3730a3';
                  }
                }}
                onMouseLeave={e => {
                  if (!ttsPlaying) {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.color = '#374151';
                  }
                }}
              >
                {ttsPlaying ? (
                  <>
                    <TtsBars />
                    재생 중
                  </>
                ) : (
                  <>
                    <Volume2Icon />
                    미리듣기
                  </>
                )}
              </button>

              {/* AI regenerate button */}
              <button
                onClick={onAiRegenerate}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 12px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: '1px solid rgba(109,40,217,0.25)',
                  background: 'rgba(109,40,217,0.10)',
                  color: '#6d28d9',
                  transition: 'background 0.18s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(109,40,217,0.16)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(109,40,217,0.10)'; }}
              >
                <Sparkles size={11} />
                AI 재생성
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TtsBars() {
  return (
    <span
      style={{
        display: 'inline-flex',
        gap: '2px',
        alignItems: 'flex-end',
        height: '12px',
      }}
    >
      {[0, 0.15, 0.3, 0.45].map((delay, i) => (
        <span
          key={i}
          style={{
            width: '2px',
            background: '#6d28d9',
            borderRadius: '1px',
            height: '8px',
            animation: `tts-bar 0.9s ease-in-out ${delay}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

const HIGHLIGHT_TOKENS = ['Authentication', 'Configure provider'];

function ScriptPreview({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    let earliest = -1;
    let matchedToken = '';

    for (const token of HIGHLIGHT_TOKENS) {
      const idx = remaining.indexOf(token);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        matchedToken = token;
      }
    }

    if (earliest === -1) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (earliest > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, earliest)}</span>);
    }

    parts.push(
      <span
        key={key++}
        style={{
          display: 'inline-block',
          padding: '1px 6px',
          background: 'rgba(245,158,11,0.18)',
          borderRadius: '4px',
          fontWeight: 500,
          color: '#92400E',
          borderBottom: '2px solid #F59E0B',
        }}
      >
        {matchedToken}
      </span>
    );

    remaining = remaining.slice(earliest + matchedToken.length);
  }

  return <>{parts}</>;
}

function Volume2Icon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  );
}

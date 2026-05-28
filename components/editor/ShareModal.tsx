'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Link2, Check, Send } from 'lucide-react';

interface ShareModalProps {
  title: string;
  shareToken: string | null;
  shareUrl: string | null;
  onPublishAndShare: () => Promise<{ share_token: string; share_url?: string }>;
  onClose: () => void;
}

export function ShareModal({ title, shareToken, shareUrl, onPublishAndShare, onClose }: ShareModalProps) {
  const [url, setUrl] = useState(shareUrl ?? '');
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // If already published, url is ready
  useEffect(() => {
    if (shareUrl) setUrl(shareUrl);
  }, [shareUrl]);

  // Auto-publish if no token yet
  useEffect(() => {
    if (shareToken) return;
    setPublishing(true);
    onPublishAndShare()
      .then(result => {
        const resolved = result.share_url ?? `${window.location.origin}/play/${result.share_token}`;
        setUrl(resolved);
      })
      .catch(() => {})
      .finally(() => setPublishing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    inputRef.current?.select();
    setTimeout(() => setCopied(false), 2200);
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} - MIMIC 매뉴얼`)}&url=${encodeURIComponent(url)}`;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,10,15,0.55)',
          zIndex: 50,
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%', maxWidth: '480px',
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.22)',
          zIndex: 51,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 24px 20px',
            borderBottom: '1px solid #F3F4F6',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
              background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
              display: 'grid', placeItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>공유하기</h2>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#6B7280', lineHeight: 1.5 }}>
              링크를 공유하면 누구든 이 매뉴얼을 볼 수 있어요.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              display: 'grid', placeItems: 'center',
              border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px' }}>
          {/* Link copy row */}
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
            공유 링크
          </label>
          <div
            style={{
              display: 'flex',
              border: '1.5px solid #E5E7EB',
              borderRadius: '10px',
              overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}
            onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#4F46E5'; }}
            onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#E5E7EB'; }}
          >
            <input
              ref={inputRef}
              readOnly
              value={publishing ? '링크 생성 중...' : url}
              style={{
                flex: 1,
                padding: '10px 14px',
                fontSize: '12.5px',
                color: publishing ? '#9CA3AF' : '#111827',
                background: '#FAFAFA',
                border: 'none',
                outline: 'none',
                fontFamily: 'ui-monospace, monospace',
                minWidth: 0,
              }}
            />
            <button
              onClick={handleCopy}
              disabled={publishing || !url}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 16px',
                background: copied ? '#10B981' : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                color: 'white',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: publishing || !url ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                transition: 'background 0.2s ease',
                whiteSpace: 'nowrap',
                opacity: publishing || !url ? 0.6 : 1,
              }}
            >
              {copied ? <Check size={13} /> : <Link2 size={13} />}
              {copied ? '복사됨!' : '링크 복사'}
            </button>
          </div>

          {/* Visibility badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '10px',
              padding: '8px 12px',
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#15803D',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            링크를 가진 누구나 볼 수 있어요 · 비공개로 변경하려면 게시 취소를 하세요.
          </div>

          {/* Divider */}
          <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: '#F3F4F6' }} />
            <span style={{ fontSize: '11.5px', color: '#9CA3AF' }}>또는 SNS로 공유</span>
            <div style={{ flex: 1, height: '1px', background: '#F3F4F6' }} />
          </div>

          {/* SNS buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <a
              href={url ? twitterUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => { if (!url) e.preventDefault(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '42px',
                borderRadius: '10px',
                border: '1.5px solid #E5E7EB',
                background: 'white',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                textDecoration: 'none',
                cursor: url ? 'pointer' : 'not-allowed',
                opacity: url ? 1 : 0.5,
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { if (url) { e.currentTarget.style.borderColor = '#1DA1F2'; e.currentTarget.style.color = '#1DA1F2'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.26 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Twitter / X
            </a>

            <button
              onClick={() => {
                if (!url) return;
                navigator.share?.({
                  title,
                  url,
                }).catch(() => handleCopy());
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '42px',
                borderRadius: '10px',
                border: '1.5px solid #E5E7EB',
                background: 'white',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                cursor: url ? 'pointer' : 'not-allowed',
                opacity: url ? 1 : 0.5,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => { if (url) { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.color = '#4F46E5'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151'; }}
            >
              <Send size={15} />
              더 많은 앱으로
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

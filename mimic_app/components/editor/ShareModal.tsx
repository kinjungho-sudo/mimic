'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Link2, Check, Send, Lock, Eye, EyeOff, Code2 } from 'lucide-react';

interface ShareModalProps {
  title: string;
  shareToken: string | null;
  shareUrl: string | null;
  tutorialId: string;
  hasPassword?: boolean;
  onPublishAndShare: () => Promise<{ share_token: string; share_url?: string }>;
  onUnpublish: () => Promise<void>;
  onClose: () => void;
}

export function ShareModal({ title, shareToken, shareUrl, tutorialId, hasPassword, onPublishAndShare, onUnpublish, onClose }: ShareModalProps) {
  const [url, setUrl] = useState(shareUrl ?? '');
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [embedUrlCopied, setEmbedUrlCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 비밀번호 설정
  const [pwInput, setPwInput] = useState('');
  const [pwVisible, setPwVisible] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwEnabled, setPwEnabled] = useState(hasPassword ?? false);

  const handleSavePassword = async () => {
    setPwSaving(true);
    try {
      await fetch(`/api/tutorials/${tutorialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_password: pwInput }),
      });
      setPwEnabled(true);
      setPwInput('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2500);
    } finally {
      setPwSaving(false);
    }
  };

  const handleRemovePassword = async () => {
    setPwSaving(true);
    try {
      await fetch(`/api/tutorials/${tutorialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_password: null }),
      });
      setPwEnabled(false);
      setPwInput('');
    } finally {
      setPwSaving(false);
    }
  };

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

  const embedUrl = url ? url.replace('/play/', '/embed/') : '';
  const embedCode = embedUrl
    ? `<iframe src="${embedUrl}" width="100%" height="640" style="border:1px solid #e5e7eb;border-radius:12px" loading="lazy" allowfullscreen></iframe>`
    : '';

  const handleCopyEmbed = async () => {
    if (!embedCode) return;
    await navigator.clipboard.writeText(embedCode).catch(() => {});
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2200);
  };

  const handleCopyEmbedUrl = async () => {
    if (!embedUrl) return;
    await navigator.clipboard.writeText(embedUrl).catch(() => {});
    setEmbedUrlCopied(true);
    setTimeout(() => setEmbedUrlCopied(false), 2200);
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} - MIMIC 매뉴얼`)}&url=${encodeURIComponent(url)}`;
  const emailUrl = url ? `mailto:?subject=${encodeURIComponent(`[MIMIC] ${title}`)}&body=${encodeURIComponent(`안녕하세요,\n\n아래 링크에서 MIMIC 매뉴얼을 확인해주세요.\n\n${title}\n${url}`)}` : undefined;

  const handleKakao = () => {
    if (!url) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Kakao = (window as any).Kakao;
    if (!Kakao) {
      window.open(`kakaotalk://msg/send?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank');
      return;
    }
    if (!Kakao.isInitialized()) {
      const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (jsKey) Kakao.init(jsKey);
    }
    if (Kakao.isInitialized()) {
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: { title, description: 'MIMIC으로 만든 단계별 인터랙티브 매뉴얼', imageUrl: '', link: { webUrl: url, mobileWebUrl: url } },
        buttons: [{ title: '매뉴얼 보기', link: { webUrl: url, mobileWebUrl: url } }],
      });
    } else {
      window.open(`kakaotalk://msg/send?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank');
    }
  };

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
              background: 'linear-gradient(135deg, #e0e7ff 0%, #F5F3FF 100%)',
              display: 'grid', placeItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
            onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3730a3'; }}
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
                background: copied ? '#10B981' : 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)',
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
              justifyContent: 'space-between',
              gap: '8px',
              marginTop: '10px',
              padding: '8px 12px',
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#15803D',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              링크를 가진 누구나 볼 수 있어요
            </div>
            <button
              onClick={async () => {
                if (!confirm('게시를 취소하면 공유 링크가 즉시 비활성화됩니다. 계속할까요?')) return;
                setUnpublishing(true);
                try {
                  await onUnpublish();
                  onClose();
                } finally {
                  setUnpublishing(false);
                }
              }}
              disabled={unpublishing}
              style={{
                flexShrink: 0,
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 500,
                background: 'white',
                color: '#DC2626',
                border: '1px solid #FCA5A5',
                cursor: unpublishing ? 'not-allowed' : 'pointer',
                opacity: unpublishing ? 0.6 : 1,
              }}
            >
              {unpublishing ? '취소 중...' : '게시 취소'}
            </button>
          </div>

          {/* 임베드 — Notion/SharePoint 등에 삽입 */}
          <div style={{ marginTop: '16px', padding: '14px 16px', background: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code2 size={13} style={{ color: '#3730a3' }} />
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#374151' }}>임베드</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={handleCopyEmbedUrl}
                  disabled={publishing || !embedUrl}
                  title="Notion 등 /embed 블록에 붙여넣는 링크"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '4px 11px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 500,
                    background: embedUrlCopied ? '#10B981' : '#3730a3', color: 'white',
                    border: `1px solid ${embedUrlCopied ? '#10B981' : '#3730a3'}`,
                    cursor: publishing || !embedUrl ? 'not-allowed' : 'pointer', opacity: publishing || !embedUrl ? 0.6 : 1,
                  }}
                >
                  {embedUrlCopied ? <Check size={12} /> : <Link2 size={12} />}
                  {embedUrlCopied ? '복사됨!' : 'Notion용 링크'}
                </button>
                <button
                  onClick={handleCopyEmbed}
                  disabled={publishing || !embedCode}
                  title="웹사이트·SharePoint 등 HTML에 붙여넣는 iframe 코드"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '4px 11px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 500,
                    background: embedCopied ? '#10B981' : 'white', color: embedCopied ? 'white' : '#3730a3',
                    border: `1px solid ${embedCopied ? '#10B981' : '#C7D2FE'}`,
                    cursor: publishing || !embedCode ? 'not-allowed' : 'pointer', opacity: publishing || !embedCode ? 0.6 : 1,
                  }}
                >
                  {embedCopied ? <Check size={12} /> : <Code2 size={12} />}
                  {embedCopied ? '복사됨!' : 'iframe 코드'}
                </button>
              </div>
            </div>
            <code style={{ display: 'block', fontSize: '11px', color: '#4B5563', background: 'white', border: '1px solid #E5E7EB', borderRadius: '7px', padding: '9px 11px', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all', lineHeight: 1.5, maxHeight: '64px', overflow: 'auto' }}>
              {publishing ? '링크 생성 중...' : embedCode}
            </code>
            <p style={{ margin: '7px 0 0', fontSize: '11px', color: '#9CA3AF', lineHeight: 1.6 }}>
              <strong style={{ color: '#6B7280', fontWeight: 600 }}>Notion</strong>은 <code style={{ background: '#EEF2FF', color: '#3730a3', padding: '1px 5px', borderRadius: '4px', fontSize: '10.5px' }}>/embed</code> 입력 후 <strong style={{ color: '#6B7280', fontWeight: 600 }}>Notion용 링크</strong>를 붙여넣으세요. iframe 코드를 그대로 붙이면 텍스트로 표시됩니다.<br />
              <strong style={{ color: '#6B7280', fontWeight: 600 }}>웹사이트·SharePoint</strong>는 iframe 코드를 HTML에 붙여넣으세요.
              {pwEnabled && ' 비밀번호가 설정된 매뉴얼은 임베드로 표시되지 않습니다.'}
            </p>
          </div>

          {/* 비밀번호 보호 */}
          <div style={{ marginTop: '16px', padding: '14px 16px', background: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: pwEnabled ? '0' : '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={13} style={{ color: pwEnabled ? '#3730a3' : '#9CA3AF' }} />
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#374151' }}>비밀번호 보호</span>
                {pwEnabled && (
                  <span style={{ fontSize: '10.5px', padding: '1px 7px', borderRadius: '20px', background: 'rgba(55,48,163,0.1)', color: '#3730a3', fontWeight: 600 }}>
                    설정됨
                  </span>
                )}
              </div>
              {pwEnabled && (
                <button
                  onClick={handleRemovePassword}
                  disabled={pwSaving}
                  style={{ fontSize: '11.5px', color: '#DC2626', background: 'none', border: 'none', cursor: pwSaving ? 'not-allowed' : 'pointer', padding: 0, opacity: pwSaving ? 0.5 : 1 }}
                >
                  해제
                </button>
              )}
            </div>
            {!pwEnabled && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type={pwVisible ? 'text' : 'password'}
                    value={pwInput}
                    onChange={e => setPwInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && pwInput.trim()) handleSavePassword(); }}
                    placeholder="비밀번호 입력"
                    style={{ width: '100%', height: '36px', padding: '0 34px 0 10px', borderRadius: '7px', border: '1.5px solid #E5E7EB', fontSize: '12.5px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3730a3'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                  />
                  <button
                    onClick={() => setPwVisible(v => !v)}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'grid', placeItems: 'center', padding: 0 }}
                  >
                    {pwVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <button
                  onClick={handleSavePassword}
                  disabled={!pwInput.trim() || pwSaving}
                  style={{ height: '36px', padding: '0 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, background: pwSaved ? '#10B981' : '#3730a3', color: 'white', border: 'none', cursor: !pwInput.trim() || pwSaving ? 'not-allowed' : 'pointer', opacity: !pwInput.trim() || pwSaving ? 0.5 : 1, transition: 'background 0.2s', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {pwSaved ? '저장됨!' : pwSaving ? '저장 중...' : '설정'}
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: '#F3F4F6' }} />
            <span style={{ fontSize: '11.5px', color: '#9CA3AF' }}>또는 SNS로 공유</span>
            <div style={{ flex: 1, height: '1px', background: '#F3F4F6' }} />
          </div>

          {/* 공유 버튼 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {/* 카카오톡 */}
            <button
              onClick={handleKakao}
              disabled={!url}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', height: '44px', borderRadius: '10px', border: 'none', background: '#FEE500', color: '#391B1B', fontSize: '12.5px', fontWeight: 600, cursor: url ? 'pointer' : 'not-allowed', opacity: url ? 1 : 0.5, transition: 'filter 0.15s' }}
              onMouseEnter={e => { if (url) e.currentTarget.style.filter = 'brightness(0.95)'; }}
              onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
            >
              <svg width="17" height="17" viewBox="0 0 18 18" fill="currentColor">
                <path d="M9 0C4.03 0 0 3.13 0 6.99c0 2.49 1.56 4.68 3.91 5.93l-.99 3.68c-.09.34.29.61.59.41L7.7 14.4c.43.06.87.09 1.3.09 4.97 0 9-3.13 9-6.99C18 3.13 13.97 0 9 0z"/>
              </svg>
              카카오톡
            </button>

            {/* 이메일 */}
            <a
              href={emailUrl}
              onClick={e => { if (!url) e.preventDefault(); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', height: '44px', borderRadius: '10px', border: '1.5px solid #E5E7EB', background: 'white', color: '#374151', fontSize: '12.5px', fontWeight: 500, textDecoration: 'none', cursor: url ? 'pointer' : 'not-allowed', opacity: url ? 1 : 0.5, transition: 'border-color 0.15s, color 0.15s' }}
              onMouseEnter={e => { if (url) { e.currentTarget.style.borderColor = '#3730a3'; e.currentTarget.style.color = '#3730a3'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151'; }}
            >
              <Send size={14} />
              이메일
            </a>

            {/* Twitter/X */}
            <a
              href={url ? twitterUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => { if (!url) e.preventDefault(); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', height: '44px', borderRadius: '10px', border: '1.5px solid #E5E7EB', background: 'white', color: '#374151', fontSize: '12.5px', fontWeight: 500, textDecoration: 'none', cursor: url ? 'pointer' : 'not-allowed', opacity: url ? 1 : 0.5, transition: 'border-color 0.15s, color 0.15s' }}
              onMouseEnter={e => { if (url) { e.currentTarget.style.borderColor = '#111827'; e.currentTarget.style.color = '#111827'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.26 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Twitter/X
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

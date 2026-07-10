'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Link2, Check, Lock, Eye, EyeOff, Code2, ChevronDown } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

interface ShareModalProps {
  title: string;
  shareToken: string | null;
  shareUrl: string | null;
  tutorialId: string;
  hasPassword?: boolean;
  visibility?: 'private' | 'public';
  onPublishAndShare: () => Promise<{ share_token: string; share_url?: string }>;
  onUnpublish: () => Promise<void>;
  onClose: () => void;
}

export function ShareModal({ title, shareToken, shareUrl, tutorialId, hasPassword, visibility: initialVisibility = 'private', onPublishAndShare, onUnpublish, onClose }: ShareModalProps) {
  const [url, setUrl] = useState(shareUrl ?? '');
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 공개 범위
  const [vis, setVis] = useState<'private' | 'public'>(initialVisibility);
  const [visSaving, setVisSaving] = useState(false);

  // 비밀번호
  const [pwEnabled, setPwEnabled] = useState(hasPassword ?? false);
  const [pwExpanded, setPwExpanded] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwVisible, setPwVisible] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  // 임베드
  const [embedExpanded, setEmbedExpanded] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [embedUrlCopied, setEmbedUrlCopied] = useState(false);

  // 이메일
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleVisChange = async (next: 'private' | 'public') => {
    setVis(next);
    setVisSaving(true);
    try {
      await fetch(`/api/tutorials/${tutorialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: next }),
      });
    } finally {
      setVisSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (!pwInput.trim()) return;
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
      setPwExpanded(false);
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
      setPwExpanded(false);
    } finally {
      setPwSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim() || !url) return;
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/share/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailTo.trim(), tutorialTitle: title, shareUrl: url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setEmailResult({ ok: false, msg: data.error ?? '발송에 실패했어요.' });
      else { setEmailResult({ ok: true, msg: `${emailTo.trim()}로 보냈어요.` }); setEmailTo(''); }
    } catch {
      setEmailResult({ ok: false, msg: '네트워크 오류가 발생했어요.' });
    } finally {
      setEmailSending(false);
    }
  };

  useEffect(() => {
    if (shareUrl) setUrl(shareUrl);
  }, [shareUrl]);

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
        content: { title, description: `${BRAND_NAME}으로 만든 단계별 인터랙티브 매뉴얼`, imageUrl: '', link: { webUrl: url, mobileWebUrl: url } },
        buttons: [{ title: '매뉴얼 보기', link: { webUrl: url, mobileWebUrl: url } }],
      });
    } else {
      window.open(`kakaotalk://msg/send?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank');
    }
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 0', borderBottom: '1px solid #F3F4F6',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,10,15,0.45)',
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
          width: '100%', maxWidth: '440px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          zIndex: 51,
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111827' }}>공유하기</h2>
          <button
            onClick={onClose}
            style={{ width: '30px', height: '30px', borderRadius: '8px', display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '16px 20px 20px' }}>
          {/* 제목 */}
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </p>

          {/* 링크 복사 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input
              ref={inputRef}
              readOnly
              value={publishing ? '링크 생성 중...' : url}
              style={{
                flex: 1, minWidth: 0, height: '40px', padding: '0 12px',
                border: '1.5px solid #E5E7EB', borderRadius: '10px',
                fontSize: '12px', color: publishing ? '#9CA3AF' : '#374151',
                background: '#FAFAFA', outline: 'none',
                fontFamily: 'ui-monospace, monospace',
              }}
            />
            <button
              onClick={handleCopy}
              disabled={publishing || !url}
              style={{
                flexShrink: 0, height: '40px', padding: '0 16px', borderRadius: '10px',
                border: 'none',
                background: copied ? '#10B981' : 'linear-gradient(135deg, #3730a3, #6d28d9)',
                color: 'white', fontSize: '13px', fontWeight: 600,
                cursor: publishing || !url ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                opacity: publishing || !url ? 0.6 : 1, whiteSpace: 'nowrap',
              }}
            >
              {copied ? <Check size={13} /> : <Link2 size={13} />}
              {copied ? '복사됨!' : '링크 복사'}
            </button>
          </div>

          {/* 공개 범위 */}
          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>공개 범위</div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                {vis === 'private' ? '링크를 가진 사람만 볼 수 있어요' : '누구나 검색하고 볼 수 있어요'}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <select
                value={vis}
                onChange={e => handleVisChange(e.target.value as 'private' | 'public')}
                disabled={visSaving}
                style={{
                  height: '34px', padding: '0 28px 0 10px',
                  borderRadius: '8px', border: '1.5px solid #E5E7EB',
                  fontSize: '12.5px', color: '#111827', background: 'white',
                  cursor: 'pointer', outline: 'none', appearance: 'none',
                  fontFamily: 'inherit', opacity: visSaving ? 0.6 : 1,
                }}
              >
                <option value="private">🔗 링크 공유</option>
                <option value="public">🌐 전체 공개</option>
              </select>
              <svg style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          {/* 비밀번호 보호 */}
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 0', cursor: 'pointer' }}
              onClick={() => { if (!pwEnabled) setPwExpanded(e => !e); }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={14} style={{ color: pwEnabled ? '#3730a3' : '#9CA3AF' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>비밀번호 보호</span>
                {pwEnabled && (
                  <span style={{ fontSize: '10.5px', padding: '1px 7px', borderRadius: '20px', background: '#EEF2FF', color: '#3730a3', fontWeight: 600 }}>
                    {pwSaved ? '변경됨!' : '설정됨'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {pwEnabled && (
                  <button onClick={e => { e.stopPropagation(); handleRemovePassword(); }} disabled={pwSaving}
                    style={{ fontSize: '11.5px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: pwSaving ? 0.5 : 1 }}>
                    해제
                  </button>
                )}
                {!pwEnabled && (
                  <ChevronDown size={14} style={{ color: '#9CA3AF', transform: pwExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                )}
              </div>
            </div>
            {!pwEnabled && pwExpanded && (
              <div style={{ padding: '10px 0 4px', display: 'flex', gap: '6px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type={pwVisible ? 'text' : 'password'}
                    value={pwInput}
                    onChange={e => setPwInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && pwInput.trim()) handleSavePassword(); }}
                    placeholder="비밀번호 입력"
                    autoFocus
                    style={{ width: '100%', height: '36px', padding: '0 34px 0 10px', borderRadius: '7px', border: '1.5px solid #E5E7EB', fontSize: '12.5px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3730a3'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                  />
                  <button onClick={() => setPwVisible(v => !v)}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'grid', placeItems: 'center', padding: 0 }}>
                    {pwVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <button
                  onClick={handleSavePassword}
                  disabled={!pwInput.trim() || pwSaving}
                  style={{ height: '36px', padding: '0 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, background: '#3730a3', color: 'white', border: 'none', cursor: !pwInput.trim() || pwSaving ? 'not-allowed' : 'pointer', opacity: !pwInput.trim() || pwSaving ? 0.5 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {pwSaving ? '저장 중...' : '설정'}
                </button>
              </div>
            )}
          </div>

          {/* 임베드 */}
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: '0', borderBottom: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 0', cursor: 'pointer' }}
              onClick={() => setEmbedExpanded(e => !e)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code2 size={14} style={{ color: embedExpanded ? '#3730a3' : '#9CA3AF' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>임베드 코드</span>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Notion · 웹사이트</span>
              </div>
              <ChevronDown size={14} style={{ color: '#9CA3AF', transform: embedExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </div>
            {embedExpanded && (
              <div style={{ padding: '10px 0 0' }}>
                <code style={{ display: 'block', fontSize: '11px', color: '#4B5563', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all', lineHeight: 1.5, maxHeight: '56px', overflow: 'auto', marginBottom: '8px' }}>
                  {publishing ? '링크 생성 중...' : embedCode}
                </code>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleCopyEmbedUrl} disabled={publishing || !embedUrl}
                    style={{ flex: 1, height: '32px', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, background: embedUrlCopied ? '#10B981' : '#3730a3', color: 'white', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', opacity: publishing || !embedUrl ? 0.5 : 1 }}>
                    {embedUrlCopied ? <Check size={11} /> : <Link2 size={11} />}
                    {embedUrlCopied ? '복사됨!' : 'Notion용 링크'}
                  </button>
                  <button onClick={handleCopyEmbed} disabled={publishing || !embedCode}
                    style={{ flex: 1, height: '32px', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, background: 'white', color: '#3730a3', border: `1px solid ${embedCopied ? '#10B981' : '#C7D2FE'}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', opacity: publishing || !embedCode ? 0.5 : 1 }}>
                    {embedCopied ? <Check size={11} /> : <Code2 size={11} />}
                    {embedCopied ? '복사됨!' : 'iframe 코드'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div style={{ margin: '16px 0', height: '1px', background: '#F3F4F6' }} />

          {/* 이메일 공유 */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>이메일로 링크 보내기</div>
            <div style={{ display: 'flex', gap: '7px' }}>
              <input
                type="email"
                value={emailTo}
                onChange={e => { setEmailTo(e.target.value); setEmailResult(null); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSendEmail(); }}
                placeholder="example@email.com"
                style={{ flex: 1, minWidth: 0, height: '38px', padding: '0 12px', borderRadius: '9px', border: `1.5px solid ${emailResult?.ok === false ? '#EF4444' : '#E5E7EB'}`, fontSize: '13px', color: '#111827', outline: 'none', fontFamily: 'inherit' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#3730a3'; }}
                onBlur={e => { e.currentTarget.style.borderColor = emailResult?.ok === false ? '#EF4444' : '#E5E7EB'; }}
              />
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={emailSending || !emailTo.trim()}
                style={{ flexShrink: 0, padding: '0 16px', height: '38px', borderRadius: '9px', border: 'none', background: emailTo.trim() ? 'linear-gradient(135deg,#3730a3,#6d28d9)' : '#E5E7EB', color: emailTo.trim() ? 'white' : '#9CA3AF', fontSize: '13px', fontWeight: 600, cursor: emailTo.trim() && !emailSending ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                {emailSending ? '발송 중…' : '보내기'}
              </button>
            </div>
            {emailResult && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: emailResult.ok ? '#10B981' : '#EF4444' }}>
                {emailResult.ok ? '✓' : '✕'} {emailResult.msg}
              </p>
            )}
          </div>

          {/* 카카오 + 게시 취소 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleKakao} disabled={!url}
              style={{ flex: 1, height: '38px', borderRadius: '9px', border: 'none', background: '#FEE500', color: '#391B1B', fontSize: '12.5px', fontWeight: 600, cursor: url ? 'pointer' : 'not-allowed', opacity: url ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onMouseEnter={e => { if (url) e.currentTarget.style.filter = 'brightness(0.95)'; }}
              onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor">
                <path d="M9 0C4.03 0 0 3.13 0 6.99c0 2.49 1.56 4.68 3.91 5.93l-.99 3.68c-.09.34.29.61.59.41L7.7 14.4c.43.06.87.09 1.3.09 4.97 0 9-3.13 9-6.99C18 3.13 13.97 0 9 0z"/>
              </svg>
              카카오톡 공유
            </button>
            <button
              onClick={async () => {
                if (!confirm('게시를 취소하면 공유 링크가 즉시 비활성화됩니다. 계속할까요?')) return;
                setUnpublishing(true);
                try { await onUnpublish(); onClose(); } finally { setUnpublishing(false); }
              }}
              disabled={unpublishing}
              style={{ flexShrink: 0, padding: '0 14px', height: '38px', borderRadius: '9px', fontSize: '12px', fontWeight: 500, background: 'white', color: '#DC2626', border: '1px solid #FCA5A5', cursor: unpublishing ? 'not-allowed' : 'pointer', opacity: unpublishing ? 0.6 : 1 }}>
              {unpublishing ? '취소 중...' : '게시 취소'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

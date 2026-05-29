'use client';

import { ChevronLeft, Play, Share2, Check, Download, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useCallback } from 'react';

export type EditorMode = 'document' | 'interactive';

interface EditorHeaderProps {
  title: string;
  tutorialId: string;
  onTitleChange: (v: string) => void;
  onPreview: () => void;
  onSave: () => Promise<void>;
  onPublish: () => void;
  onShare: () => void;
  onUndo: () => void;
  canUndo: boolean;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}

export function EditorHeader({ title, tutorialId, onTitleChange, onPreview, onSave, onPublish, onShare, onUndo, canUndo, mode, onModeChange }: EditorHeaderProps) {
  const [localTitle, setLocalTitle] = useState(title);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const format = mode === 'document' ? 'pdf' : 'pptx';
      const res = await fetch(`/api/export/${format}/${tutorialId}`);
      if (!res.ok) { alert('내보내기 실패. 스텝이 없거나 오류가 발생했습니다.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? `manual.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [mode, tutorialId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      height: '56px',
      padding: '0 18px',
      background: '#111827',
      color: 'white',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
    }}>
      {/* 뒤로 */}
      <Link
        href="/dashboard"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', textDecoration: 'none', transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
      >
        <ChevronLeft size={14} />
        내 매뉴얼
      </Link>

      {/* 제목 */}
      <input
        value={localTitle}
        onChange={e => { setLocalTitle(e.target.value); onTitleChange(e.target.value); }}
        style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.9)', fontWeight: 500, background: 'transparent', border: '1px solid transparent', outline: 'none', padding: '4px 8px', borderRadius: '6px', minWidth: '200px', maxWidth: '320px', cursor: 'text', transition: 'border-color 0.15s, background 0.15s' }}
        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
      />

      {/* 자동저장 */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(16,185,129,0.8)', whiteSpace: 'nowrap' }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
        자동 저장됨
      </span>

      {/* ── 중앙 모드 토글 (Guidde 스타일) ── */}
      <div style={{ marginLeft: 'auto', marginRight: 'auto', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.07)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
        {([
          { key: 'document',    label: '가이드 문서', icon: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          )},
          { key: 'interactive', label: '인터랙티브', icon: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )},
        ] as { key: EditorMode; label: string; icon: React.ReactNode }[]).map(tab => {
          const active = mode === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onModeChange(tab.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontSize: '12.5px', fontWeight: active ? 600 : 400,
                background: active ? 'white' : 'transparent',
                color: active ? '#111827' : 'rgba(255,255,255,0.5)',
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 우측 액션 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="실행 취소 (Ctrl+Z)"
          style={{ height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: canUndo ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', cursor: canUndo ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', transition: 'all 0.15s', opacity: canUndo ? 1 : 0.5 }}
          onMouseEnter={e => { if (canUndo) { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white'; } }}
          onMouseLeave={e => { if (canUndo) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; } }}
        >
          <Undo2 size={13} />
          실행 취소
        </button>

        <button
          onClick={onPreview}
          style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
        >
          <Play size={13} />
          미리보기
        </button>

        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', cursor: exporting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s', opacity: exporting ? 0.6 : 1 }}
          onMouseEnter={e => { if (!exporting) { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white'; } }}
          onMouseLeave={e => { if (!exporting) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; } }}
        >
          <Download size={13} />
          {exporting ? '생성 중...' : mode === 'document' ? 'PDF' : 'PPTX'}
        </button>

        <button
          onClick={onShare}
          style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
        >
          <Share2 size={13} />
          공유
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            color: saved ? '#10B981' : 'rgba(255,255,255,0.85)',
            background: saved ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${saved ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.12)'}`,
            cursor: saving ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.2s',
            opacity: saving ? 0.6 : 1,
          }}
          onMouseEnter={e => { if (!saving && !saved) { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white'; } }}
          onMouseLeave={e => { if (!saving && !saved) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; } }}
        >
          {saved ? <Check size={13} /> : null}
          {saving ? '저장 중...' : saved ? '저장됨' : '편집 완료'}
        </button>

        <button
          onClick={onPublish}
          style={{ height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'white', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'box-shadow 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,70,229,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
        >
          게시
        </button>
      </div>
    </header>
  );
}

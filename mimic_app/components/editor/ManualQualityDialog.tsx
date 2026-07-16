'use client';

import { AlertTriangle, Loader2, Wand2, X } from 'lucide-react';
import type { ManualQualityIssue } from '@/lib/manual-quality';

type Props = {
  issues: ManualQualityIssue[];
  onClose: () => void;
  onRegenerate?: () => void;
  onSelectStep?: (stepNumber: number) => void;
  regenerating?: boolean;
};

export function ManualQualityDialog({ issues, onClose, onRegenerate, onSelectStep, regenerating = false }: Props) {
  const errors = issues.filter(issue => issue.severity === 'error');
  const warnings = issues.filter(issue => issue.severity === 'warning');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="manual-quality-title" style={{ width: 'min(520px, 100%)', maxHeight: 'min(680px, 88vh)', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 16, boxShadow: '0 24px 70px rgba(15,23,42,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 14px', borderBottom: '1px solid #EEF2F7' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', color: '#B45309', background: '#FEF3C7', flexShrink: 0 }}><AlertTriangle size={20} /></div>
          <div style={{ flex: 1 }}>
            <h2 id="manual-quality-title" style={{ margin: 0, fontSize: 17, color: '#111827' }}>게시 전 품질 점검이 필요해요</h2>
            <p style={{ margin: '5px 0 0', fontSize: 12.5, lineHeight: 1.55, color: '#6B7280' }}>사용자가 목적을 이해하고 안전하게 따라할 수 있도록 아래 항목을 먼저 수정해주세요.</p>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#F3F4F6', color: '#6B7280', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={15} /></button>
        </div>

        <div style={{ padding: '14px 20px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
            <span style={{ padding: '4px 8px', borderRadius: 20, background: '#FEE2E2', color: '#B91C1C', fontSize: 11.5, fontWeight: 700 }}>수정 필요 {errors.length}</span>
            {warnings.length > 0 && <span style={{ padding: '4px 8px', borderRadius: 20, background: '#FEF3C7', color: '#92400E', fontSize: 11.5, fontWeight: 700 }}>확인 권장 {warnings.length}</span>}
          </div>
          <div style={{ display: 'grid', gap: 7 }}>
            {issues.slice(0, 12).map((issue, index) => (
              <button
                key={`${issue.code}-${issue.stepId ?? index}`}
                onClick={() => issue.stepNumber && onSelectStep?.(issue.stepNumber)}
                disabled={!issue.stepNumber || !onSelectStep}
                style={{ textAlign: 'left', padding: '10px 11px', borderRadius: 9, border: `1px solid ${issue.severity === 'error' ? '#FECACA' : '#FDE68A'}`, background: issue.severity === 'error' ? '#FFF7F7' : '#FFFBEB', color: '#374151', fontSize: 12.5, lineHeight: 1.5, cursor: issue.stepNumber && onSelectStep ? 'pointer' : 'default' }}
              >
                {issue.message}
              </button>
            ))}
          </div>
          {issues.length > 12 && <p style={{ margin: '10px 2px 0', fontSize: 11.5, color: '#9CA3AF' }}>그 외 {issues.length - 12}개 항목이 더 있습니다.</p>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px 18px', borderTop: '1px solid #EEF2F7' }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', color: '#4B5563', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>직접 수정</button>
          {onRegenerate && (
            <button onClick={onRegenerate} disabled={regenerating} style={{ height: 36, padding: '0 15px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#009B8E,#12B886)', color: 'white', cursor: regenerating ? 'not-allowed' : 'pointer', opacity: regenerating ? 0.7 : 1, fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {regenerating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={14} />}
              전체 제목·본문 AI 재작성
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

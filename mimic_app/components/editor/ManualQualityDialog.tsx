'use client';

import { AlertTriangle, Loader2, Wand2, X } from 'lucide-react';
import type { ManualQualityIssue } from '@/lib/manual-quality';

type Props = {
  issues: ManualQualityIssue[];
  onClose: () => void;
  onRegenerate?: () => void;
  onSelectStep?: (stepNumber: number) => void;
  regenerating?: boolean;
  regenerateMessage?: string | null;
};

const TEXT_ISSUE_CODES = new Set<ManualQualityIssue['code']>(['tutorial_title', 'step_title', 'step_script', 'duplicate_title']);

export function ManualQualityDialog({ issues, onClose, onRegenerate, onSelectStep, regenerating = false, regenerateMessage }: Props) {
  const errors = issues.filter(issue => issue.severity === 'error');
  const warnings = issues.filter(issue => issue.severity === 'warning');
  const canRegenerate = !!onRegenerate && issues.some(issue => TEXT_ISSUE_CODES.has(issue.code));
  const regenerateSucceeded = regenerateMessage?.includes('다시 작성했습니다.') ?? false;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="manual-quality-title" style={{ width: 'min(520px, 100%)', maxHeight: 'min(680px, 88vh)', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 16, boxShadow: '0 24px 70px rgba(15,23,42,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 14px', borderBottom: '1px solid #EEF2F7' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', color: '#B45309', background: '#FEF3C7', flexShrink: 0 }}><AlertTriangle size={20} /></div>
          <div style={{ flex: 1 }}>
            <h2 id="manual-quality-title" style={{ margin: 0, fontSize: 17, color: '#111827' }}>게시 전에 확인할 내용이 있어요</h2>
            <p style={{ margin: '5px 0 0', fontSize: 12.5, lineHeight: 1.55, color: '#6B7280' }}>시스템 오류가 아니며 작업은 안전하게 저장되어 있어요. 아래 항목을 확인한 뒤 다시 게시해주세요.</p>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#F3F4F6', color: '#6B7280', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={15} /></button>
        </div>

        <div style={{ padding: '14px 20px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
            <span style={{ padding: '4px 8px', borderRadius: 20, background: '#FEE2E2', color: '#B91C1C', fontSize: 11.5, fontWeight: 700 }}>게시 전 확인 {errors.length}</span>
            {warnings.length > 0 && <span style={{ padding: '4px 8px', borderRadius: 20, background: '#FEF3C7', color: '#92400E', fontSize: 11.5, fontWeight: 700 }}>개선 제안 {warnings.length}</span>}
          </div>
          <div style={{ display: 'grid', gap: 7 }}>
            {issues.slice(0, 12).map((issue, index) => {
              const stepNumbers = issue.relatedStepNumbers?.length
                ? issue.relatedStepNumbers
                : issue.stepNumber ? [issue.stepNumber] : [];
              return (
                <div
                  key={`${issue.code}-${issue.stepId ?? index}`}
                  style={{ textAlign: 'left', padding: '10px 11px', borderRadius: 9, border: `1px solid ${issue.severity === 'error' ? '#FECACA' : '#FDE68A'}`, background: issue.severity === 'error' ? '#FFF7F7' : '#FFFBEB', color: '#374151', fontSize: 12.5, lineHeight: 1.5 }}
                >
                  <div>{issue.message}</div>
                  {onSelectStep && stepNumbers.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                      {stepNumbers.map(stepNumber => (
                        <button
                          key={stepNumber}
                          type="button"
                          data-testid="quality-step-link"
                          onClick={() => onSelectStep(stepNumber)}
                          aria-label={`${stepNumber}단계 편집으로 이동`}
                          style={{ height: 25, padding: '0 8px', borderRadius: 6, border: '1px solid #D1D5DB', background: 'white', color: '#374151', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {stepNumber}단계 열기
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {issues.length > 12 && <p style={{ margin: '10px 2px 0', fontSize: 11.5, color: '#9CA3AF' }}>그 외 {issues.length - 12}개 항목이 더 있습니다.</p>}
          {regenerateMessage && (
            <p role="status" aria-live="polite" style={{ margin: '12px 0 0', padding: '9px 10px', borderRadius: 8, background: regenerateSucceeded ? '#F0FDF4' : '#FFF7F7', color: regenerateSucceeded ? '#047857' : '#B91C1C', fontSize: 12, lineHeight: 1.5 }}>
              {regenerateMessage}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px 18px', borderTop: '1px solid #EEF2F7' }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', color: '#4B5563', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>직접 수정</button>
          {canRegenerate && (
            <button onClick={onRegenerate} disabled={regenerating} style={{ height: 36, padding: '0 15px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#009B8E,#12B886)', color: 'white', cursor: regenerating ? 'not-allowed' : 'pointer', opacity: regenerating ? 0.7 : 1, fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {regenerating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={14} />}
              {regenerating ? 'AI로 문구 다듬는 중…' : 'AI로 문구 다듬기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

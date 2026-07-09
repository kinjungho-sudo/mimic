'use client';

import { useState, type ReactNode } from 'react';

type SurveyQuestions = {
  ease: string;
  reuse: string;
  useful: string;
  reproduce: string;
  commentPlaceholder?: string;
};

type Props = {
  tutorialId: string;
  surface: 'editor' | 'practice-studio' | 'live-studio' | 'player';
  storageKey: string;
  title: string;
  description?: string;
  questions: SurveyQuestions;
  onClose: () => void;
};

function markDone(storageKey: string) {
  try { window.localStorage.setItem(storageKey, new Date().toISOString()); } catch { /* ignore */ }
}

function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          style={{ border: 'none', background: 'transparent', color: n <= (hovered || value) ? '#f59e0b' : '#D1D5DB', fontSize: 22, cursor: 'pointer', padding: 2 }}
          aria-label={`${n} stars`}
        >
          *
        </button>
      ))}
    </div>
  );
}

export function ProductSurveyModal({ tutorialId, surface, storageKey, title, description, questions, onClose }: Props) {
  const [ease, setEase] = useState(0);
  const [reuse, setReuse] = useState(0);
  const [useful, setUseful] = useState(0);
  const [reproduce, setReproduce] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    markDone(storageKey);
    onClose();
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorial_id: tutorialId,
          viewer_session_id: `${surface}:${tutorialId}:${Date.now()}`,
          q1_easier_than_pdf: ease || 3,
          q2_would_use_again: reuse || 3,
          q3_useful_for_work: useful || 3,
          q4_can_reproduce: reproduce ?? true,
          q5_additional_feedback: comment.trim() || undefined,
        }),
      });
    } finally {
      setSubmitting(false);
      close();
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', background: 'rgba(17,24,39,0.56)', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ width: 'min(520px, 100%)', borderRadius: 10, background: 'white', boxShadow: '0 24px 80px rgba(0,0,0,0.28)', color: '#111827', overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px 12px', borderBottom: '1px solid #EEF2F7' }}>
          <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.35 }}>{title}</h2>
          {description && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>{description}</p>}
        </div>
        <div style={{ padding: 22, display: 'grid', gap: 16 }}>
          <Question label={questions.ease}><StarRating value={ease} onChange={setEase} /></Question>
          <Question label={questions.reuse}><StarRating value={reuse} onChange={setReuse} /></Question>
          <Question label={questions.useful}><StarRating value={useful} onChange={setUseful} /></Question>
          <Question label={questions.reproduce}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setReproduce(opt.value)}
                  style={{ flex: 1, height: 36, borderRadius: 8, border: `1px solid ${reproduce === opt.value ? '#3730a3' : '#E5E7EB'}`, background: reproduce === opt.value ? '#EEF2FF' : 'white', color: reproduce === opt.value ? '#3730a3' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Question>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={questions.commentPlaceholder ?? 'Share one thing we should improve.'}
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E5E7EB', padding: 11, fontSize: 13, resize: 'vertical', outline: 'none', color: '#111827' }}
          />
        </div>
        <div style={{ padding: '14px 22px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #EEF2F7' }}>
          <button type="button" onClick={close} style={{ height: 36, padding: '0 14px', border: 'none', background: 'transparent', color: '#6B7280', cursor: 'pointer', fontSize: 13 }}>Skip</button>
          <button type="button" onClick={submit} disabled={submitting} style={{ height: 36, padding: '0 16px', border: 'none', borderRadius: 8, background: '#3730a3', color: 'white', cursor: submitting ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700 }}>
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Question({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 7 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{label}</span>
      {children}
    </label>
  );
}

export function hasSeenProductSurvey(storageKey: string) {
  try { return !!window.localStorage.getItem(storageKey); } catch { return true; }
}

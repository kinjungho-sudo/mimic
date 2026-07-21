'use client';

import { useEffect, useState } from 'react';

interface SurveyResponse {
  id: string;
  tutorial_id: string;
  viewer_session_id: string;
  q1_easier_than_pdf: number;
  q2_would_use_again: number;
  q3_useful_for_work: number;
  q4_can_reproduce: boolean;
  q5_additional_feedback: string | null;
  created_at: string;
  mm_tutorials: { title: string } | null;
}

function Stars({ value }: { value: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= value ? '#F59E0B' : '#E2E8F0', fontSize: '14px' }}>★</span>
      ))}
    </span>
  );
}

function parseFeedback(raw: string | null) {
  if (!raw) return { context: 'manual_viewer', issue: '', comment: '' };
  try {
    const data = JSON.parse(raw) as { survey_context?: string; selected_issue?: string; comment?: string | null };
    return {
      context: data.survey_context ?? 'manual_viewer',
      issue: data.selected_issue ?? '',
      comment: data.comment ?? '',
    };
  } catch {
    return { context: 'manual_viewer', issue: '', comment: raw };
  }
}

function contextLabel(context: string) {
  if (context === 'manual_created') return '생성 직후';
  if (context === 'live_guide') return 'Live Guide';
  return '매뉴얼 뷰어';
}

export default function AdminSurveysPage() {
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/surveys')
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? '설문 응답을 불러오지 못했습니다.');
        return d;
      })
      .then(d => setSurveys(d.surveys ?? []))
      .catch(e => setError(e instanceof Error ? e.message : '설문 응답을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const avg = (key: keyof Pick<SurveyResponse, 'q1_easier_than_pdf' | 'q2_would_use_again' | 'q3_useful_for_work'>) => {
    if (surveys.length === 0) return '-';
    const sum = surveys.reduce((acc, s) => acc + s[key], 0);
    return (sum / surveys.length).toFixed(1);
  };

  const reproduceRate = surveys.length === 0 ? '-' : `${Math.round(surveys.filter(s => s.q4_can_reproduce).length / surveys.length * 100)}%`;
  const feedbackCount = surveys.filter(s => s.q5_additional_feedback).length;

  return (
    <div className="admin-page" style={{ padding: '36px 40px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px', color: '#0F172A' }}>설문 응답</h1>
        <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>총 {surveys.length}개 응답</p>
      </div>

      <div className="admin-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'PDF보다 쉬움', value: avg('q1_easier_than_pdf'), unit: '/ 5', color: '#009B8E', bg: '#E8FFF7' },
          { label: '다시 사용 의향', value: avg('q2_would_use_again'), unit: '/ 5', color: '#0369A1', bg: '#F0F9FF' },
          { label: '업무 유용성', value: avg('q3_useful_for_work'), unit: '/ 5', color: '#059669', bg: '#ECFDF5' },
          { label: '재현 가능', value: reproduceRate, unit: '', color: '#12B886', bg: '#F7FFF8' },
        ].map(card => (
          <div key={card.label} style={{ background: card.bg, border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px 20px' }}>
            <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{card.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: card.color }}>
              {card.value}<span style={{ fontSize: '13px', fontWeight: 400, color: '#94A3B8' }}>{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {feedbackCount > 0 && (
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginBottom: '14px' }}>주관식 피드백 ({feedbackCount}개)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {surveys.filter(s => s.q5_additional_feedback).map(s => {
              const feedback = parseFeedback(s.q5_additional_feedback);
              return (
                <div key={s.id} style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: '8px', fontSize: '13px', color: '#374151' }}>
                  <div style={{ marginBottom: '6px', color: '#94A3B8', fontSize: '11.5px' }}>
                    {contextLabel(feedback.context)} · {s.mm_tutorials?.title ?? '(삭제된 튜토리얼)'} · {new Date(s.created_at).toLocaleDateString('ko-KR')}
                  </div>
                  {feedback.issue && <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: feedback.comment ? 4 : 0 }}>{feedback.issue}</div>}
                  {feedback.comment}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <div role="alert" style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '8px', background: '#FEF2F2', color: '#B91C1C' }}>{error}</div>}
      <div className="admin-table-scroll" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['구분', '튜토리얼', 'Q1', 'Q2', 'Q3', '완료/재현', '응답일'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11.5px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>로딩 중...</td></tr>
            ) : surveys.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>응답이 없습니다.</td></tr>
            ) : surveys.map(s => {
              const feedback = parseFeedback(s.q5_additional_feedback);
              return (
                <tr key={s.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '13px 16px', fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>{contextLabel(feedback.context)}</td>
                  <td style={{ padding: '13px 16px', fontSize: '13px', color: '#0F172A', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.mm_tutorials?.title ?? <span style={{ color: '#94A3B8' }}>(삭제됨)</span>}
                  </td>
                  <td style={{ padding: '13px 16px' }}><Stars value={s.q1_easier_than_pdf} /></td>
                  <td style={{ padding: '13px 16px' }}><Stars value={s.q2_would_use_again} /></td>
                  <td style={{ padding: '13px 16px' }}><Stars value={s.q3_useful_for_work} /></td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 500, background: s.q4_can_reproduce ? '#DCFCE7' : '#FEE2E2', color: s.q4_can_reproduce ? '#16A34A' : '#DC2626' }}>
                      {s.q4_can_reproduce ? '예' : '아니오'}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: '12px', color: '#94A3B8' }}>
                    {new Date(s.created_at).toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

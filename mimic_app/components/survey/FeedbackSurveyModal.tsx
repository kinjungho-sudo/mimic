'use client';

import { useState } from 'react';

type SurveyKind = 'manual_created' | 'manual_viewer' | 'live_guide';

type SurveyConfig = {
  title: string;
  subtitle: string;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  q5: string;
  q5Options: string[];
};

const SURVEY_CONFIG: Record<SurveyKind, SurveyConfig> = {
  manual_created: {
    title: '매뉴얼 생성은 어땠나요?',
    subtitle: '3문항은 선택만 해도 충분해요.',
    q1: '자동 생성된 제목과 설명이 실제 행동을 잘 설명했나요?',
    q2: '생성 후 수정이 적었나요?',
    q3: '바로 공유하거나 사용할 수 있을 것 같나요?',
    q4: '이 매뉴얼을 실제로 사용해도 괜찮겠나요?',
    q5: '가장 아쉬운 부분은 무엇인가요?',
    q5Options: ['제목', '단계 설명', '이미지 위치', '어노테이션', '단계 누락', '문제 없음'],
  },
  manual_viewer: {
    title: '매뉴얼을 따라보기 쉬웠나요?',
    subtitle: '보는 경험을 더 매끄럽게 만들고 싶어요.',
    q1: '이 매뉴얼만 보고 따라 할 수 있을 것 같나요?',
    q2: '강조 표시나 설명이 봐야 할 위치를 잘 알려줬나요?',
    q3: '이 매뉴얼을 다른 사람에게 공유하고 싶나요?',
    q4: '혼자서도 작업을 재현할 수 있겠나요?',
    q5: '보는 중 가장 불편했던 점은 무엇인가요?',
    q5Options: ['설명 부족', '화면 위치 부정확', '단계가 김', '이미지가 작음', '공유 전 수정 필요', '문제 없음'],
  },
  live_guide: {
    title: 'Live Guide Beta는 어땠나요?',
    subtitle: '실제 화면 위 안내가 도움이 됐는지 알려주세요.',
    q1: 'Live Guide가 실제 작업 완료에 도움이 됐나요?',
    q2: '클릭 위치나 다음 행동 안내가 정확했나요?',
    q3: '다음에도 비슷한 작업에 Live Guide를 쓰고 싶나요?',
    q4: '이번 작업을 끝까지 완료했나요?',
    q5: '진행 중 가장 불편했던 점은 무엇인가요?',
    q5Options: ['막힌 단계 없음', '클릭 위치 부정확', '설명 부족', '화면 전환 문제', '자동 입력 문제', '완료 못함'],
  },
};

function Rating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            width: 34,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${value === n ? '#3730a3' : '#E5E7EB'}`,
            background: value === n ? '#EEF2FF' : 'white',
            color: value === n ? '#3730a3' : '#6B7280',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function FeedbackSurveyModal({
  kind,
  tutorialId,
  viewerSessionId,
  onClose,
}: {
  kind: SurveyKind;
  tutorialId: string;
  viewerSessionId: string;
  onClose: () => void;
}) {
  const config = SURVEY_CONFIG[kind];
  const [q1, setQ1] = useState(0);
  const [q2, setQ2] = useState(0);
  const [q3, setQ3] = useState(0);
  const [q4, setQ4] = useState<boolean | null>(null);
  const [issue, setIssue] = useState(config.q5Options[0] ?? '');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => onClose();

  const submit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorial_id: tutorialId,
          viewer_session_id: viewerSessionId,
          q1_easier_than_pdf: q1 || 3,
          q2_would_use_again: q2 || 3,
          q3_useful_for_work: q3 || 3,
          q4_can_reproduce: q4 ?? true,
          q5_additional_feedback: JSON.stringify({
            survey_context: kind,
            selected_issue: issue,
            comment: comment.trim() || null,
            schema_version: 1,
          }),
        }),
      });
    } catch {
      // 설문은 제품 사용을 막지 않는다.
    }
    close();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'grid', placeItems: 'center', padding: 24, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
      <div style={{ width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto', borderRadius: 14, background: 'white', boxShadow: '0 24px 80px rgba(15,23,42,0.28)', color: '#111827' }}>
        <div style={{ padding: '24px 26px 18px', borderBottom: '1px solid #F3F4F6' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>{config.title}</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>{config.subtitle}</p>
        </div>

        <div style={{ padding: '20px 26px 6px', display: 'grid', gap: 18 }}>
          {[
            [config.q1, q1, setQ1],
            [config.q2, q2, setQ2],
            [config.q3, q3, setQ3],
          ].map(([label, value, setter]) => (
            <label key={String(label)} style={{ display: 'grid', gap: 9, fontSize: 13, fontWeight: 700 }}>
              <span>{String(label)}</span>
              <Rating value={value as number} onChange={setter as (value: number) => void} />
            </label>
          ))}

          <div style={{ display: 'grid', gap: 9 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{config.q4}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ label: '예', value: true }, { label: '아니오', value: false }].map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setQ4(opt.value)}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 8,
                    border: `1px solid ${q4 === opt.value ? '#3730a3' : '#E5E7EB'}`,
                    background: q4 === opt.value ? '#EEF2FF' : 'white',
                    color: q4 === opt.value ? '#3730a3' : '#4B5563',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: 'grid', gap: 9, fontSize: 13, fontWeight: 700 }}>
            <span>{config.q5}</span>
            <select
              value={issue}
              onChange={e => setIssue(e.target.value)}
              style={{ height: 36, borderRadius: 8, border: '1px solid #E5E7EB', padding: '0 10px', fontSize: 13, color: '#111827', background: 'white' }}
            >
              {config.q5Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>

          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="더 남기고 싶은 의견이 있으면 적어주세요. (선택)"
            maxLength={500}
            style={{ minHeight: 74, resize: 'vertical', borderRadius: 8, border: '1px solid #E5E7EB', padding: '10px 12px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 26px 24px' }}>
          <button type="button" onClick={close} style={{ height: 38, padding: '0 16px', border: 'none', background: 'transparent', color: '#6B7280', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            건너뛰기
          </button>
          <button type="button" onClick={submit} disabled={submitting} style={{ height: 38, padding: '0 18px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg,#3730a3,#6d28d9)', color: 'white', fontSize: 13, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? '제출 중...' : '제출하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/common/BrandMark';
import { BRAND_COLORS, BRAND_NAME } from '@/lib/brand';

export default function OnboardingPracticePage() {
  const [started, setStarted] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [checked, setChecked] = useState(false);

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #F5F7FF 0%, #FFFFFF 72%)', color: '#111827', fontFamily: "'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid #E5E7EB', background: 'rgba(255,255,255,.9)' }}>
        <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '9px', color: BRAND_COLORS.primary, textDecoration: 'none', fontWeight: 800 }}>
          <BrandMark size={30} />
          {BRAND_NAME}
        </Link>
        <span style={{ padding: '5px 10px', borderRadius: '999px', background: '#EEF2FF', color: '#4338CA', fontSize: '12px', fontWeight: 700 }}>
          안전한 연습 페이지
        </span>
      </header>

      <section style={{ width: 'min(760px, calc(100% - 32px))', margin: '0 auto', padding: '70px 0 90px' }}>
        <p style={{ margin: '0 0 8px', color: '#4F46E5', fontSize: '12px', fontWeight: 800, letterSpacing: '.08em' }}>PARRO LIVE GUIDE</p>
        <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(28px, 5vw, 42px)', lineHeight: 1.2, letterSpacing: '-.04em' }}>첫 매뉴얼 만들기를 연습해요</h1>
        <p style={{ margin: '0 0 34px', maxWidth: '620px', color: '#64748B', fontSize: '15px', lineHeight: 1.7 }}>
          이 페이지에는 외부 서비스나 실제 고객 데이터가 없습니다. 아래 세 가지 동작만 Recorder로 기록해보세요.
        </p>

        <div style={{ display: 'grid', gap: '16px' }}>
          <article style={{ padding: '22px', border: `1px solid ${started ? '#A7F3D0' : '#E5E7EB'}`, borderRadius: '16px', background: 'white', boxShadow: '0 8px 28px rgba(15,23,42,.06)' }}>
            <span style={{ display: 'inline-grid', width: '28px', height: '28px', placeItems: 'center', borderRadius: '50%', background: '#EEF2FF', color: '#4338CA', fontSize: '12px', fontWeight: 800 }}>1</span>
            <h2 style={{ margin: '12px 0 6px', fontSize: '17px' }}>온보딩 작업 시작</h2>
            <p style={{ margin: '0 0 14px', color: '#64748B', fontSize: '13px', lineHeight: 1.6 }}>버튼 클릭이 하나의 단계로 캡처되는 과정을 확인합니다.</p>
            <button
              data-parro-guide="practice-primary-action"
              type="button"
              onClick={() => setStarted(true)}
              style={{ minHeight: '42px', padding: '0 16px', border: 0, borderRadius: '10px', background: started ? '#059669' : '#4F46E5', color: 'white', fontWeight: 700, cursor: 'pointer' }}
            >
              {started ? '시작됨 ✓' : '고객 온보딩 시작'}
            </button>
          </article>

          <article style={{ padding: '22px', border: `1px solid ${workspaceName ? '#A7F3D0' : '#E5E7EB'}`, borderRadius: '16px', background: 'white', boxShadow: '0 8px 28px rgba(15,23,42,.06)' }}>
            <span style={{ display: 'inline-grid', width: '28px', height: '28px', placeItems: 'center', borderRadius: '50%', background: '#EEF2FF', color: '#4338CA', fontSize: '12px', fontWeight: 800 }}>2</span>
            <label htmlFor="practice-workspace" style={{ display: 'block', margin: '12px 0 8px', fontSize: '17px', fontWeight: 700 }}>연습 문구 입력</label>
            <input
              id="practice-workspace"
              data-parro-guide="practice-input"
              value={workspaceName}
              onChange={event => setWorkspaceName(event.target.value)}
              placeholder="예: 신규 입사자 안내"
              autoComplete="off"
              style={{ width: '100%', boxSizing: 'border-box', minHeight: '44px', padding: '0 13px', border: '1.5px solid #CBD5E1', borderRadius: '10px', outlineColor: '#4F46E5', fontSize: '14px' }}
            />
          </article>

          <article data-parro-guide="practice-finish" style={{ padding: '22px', border: `1px solid ${checked ? '#A7F3D0' : '#E5E7EB'}`, borderRadius: '16px', background: 'white', boxShadow: '0 8px 28px rgba(15,23,42,.06)' }}>
            <span style={{ display: 'inline-grid', width: '28px', height: '28px', placeItems: 'center', borderRadius: '50%', background: '#EEF2FF', color: '#4338CA', fontSize: '12px', fontWeight: 800 }}>3</span>
            <h2 style={{ margin: '12px 0 6px', fontSize: '17px' }}>완료 상태 확인</h2>
            <p style={{ margin: '0 0 14px', color: '#64748B', fontSize: '13px', lineHeight: 1.6 }}>
              Recorder에서 잘못 기록한 단계는 실행 취소하고, 필요하면 잠시 멈춘 뒤 녹화를 완료하세요.
            </p>
            <button
              type="button"
              onClick={() => setChecked(true)}
              style={{ minHeight: '42px', padding: '0 16px', border: '1px solid #CBD5E1', borderRadius: '10px', background: checked ? '#ECFDF5' : 'white', color: checked ? '#047857' : '#334155', fontWeight: 700, cursor: 'pointer' }}
            >
              {checked ? '확인 완료 ✓' : '완료 상태 확인'}
            </button>
          </article>
        </div>

        <div style={{ marginTop: '24px', padding: '14px 16px', borderRadius: '12px', background: '#FFFBEB', color: '#92400E', fontSize: '12.5px', lineHeight: 1.6 }}>
          녹화를 마치면 새 편집기 탭이 열립니다. 이 연습 매뉴얼은 비공개 초안으로만 저장되며 자동 게시·공유되지 않습니다.
        </div>
      </section>
    </main>
  );
}


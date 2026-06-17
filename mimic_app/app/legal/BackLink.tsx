'use client';

import { useRouter } from 'next/navigation';

// 약관/개인정보 페이지의 "돌아가기" — 직전 화면으로 복귀(설정·회원가입 등).
// 히스토리가 없으면 홈으로. (구버전은 /auth/signup으로 하드코딩돼 로그인 화면으로 튕기던 버그)
export function BackLink() {
  const router = useRouter();
  return (
    <button
      onClick={() => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/home'); }}
      style={{ fontSize: '13px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
    >
      ← 돌아가기
    </button>
  );
}

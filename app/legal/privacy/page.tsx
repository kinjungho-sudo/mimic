import Link from 'next/link';

export const metadata = { title: '개인정보 처리방침 — MIMIC' };

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <header style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '0 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, color: '#111827', textDecoration: 'none' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', display: 'grid', placeItems: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
                <rect x="3.2" y="5.2" width="11" height="2.4" rx="1.2" fill="white" fillOpacity="0.5"/>
                <rect x="3.2" y="10.8" width="14" height="2.4" rx="1.2" fill="white"/>
                <rect x="3.2" y="16.4" width="8" height="2.4" rx="1.2" fill="white" fillOpacity="0.5"/>
                <circle cx="18.7" cy="17.6" r="3.6" fill="white"/>
                <path d="M17.6 16.1 L20.1 17.6 L17.6 19.1 Z" fill="#4F46E5"/>
              </svg>
            </span>
            MIMIC
          </Link>
          <Link href="/auth/signup" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>← 회원가입으로 돌아가기</Link>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 500, margin: '0 0 8px', color: '#111827' }}>개인정보 처리방침</h1>
        <p style={{ fontSize: '13.5px', color: '#6B7280', margin: '0 0 40px' }}>최종 수정일: 2026년 5월 27일 · 시행일: 2026년 5월 27일</p>

        {[
          {
            title: '제1조 (개인정보의 처리 목적)',
            body: '코마인드웍스(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다. (1) 서비스 제공: 매뉴얼 제작, 공유, 플레이어 기능 제공, (2) 회원 관리: 회원제 서비스 이용에 따른 본인 확인, 개인 식별, 불량회원의 부정 이용 방지, (3) 마케팅 및 광고 활용 (동의한 경우에 한함): 이벤트 및 광고성 정보 제공.',
          },
          {
            title: '제2조 (처리하는 개인정보의 항목)',
            body: '회사는 다음의 개인정보 항목을 처리하고 있습니다. [필수] 이메일 주소, 이름(닉네임), 프로필 이미지(Google 연동 시). [자동 수집] 서비스 이용 기록, 접속 로그, IP 주소, 쿠키, 기기 정보. [선택] 마케팅 수신 동의 여부.',
          },
          {
            title: '제3조 (개인정보의 처리 및 보유기간)',
            body: '회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다. 회원 탈퇴 시 지체없이 파기합니다. 단, 관계 법령에 의해 보존할 필요가 있는 경우 해당 기간 동안 보존합니다.',
          },
          {
            title: '제4조 (개인정보의 제3자 제공)',
            body: '회사는 정보주체의 개인정보를 제1조에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다. 현재 회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다.',
          },
          {
            title: '제5조 (개인정보처리의 위탁)',
            body: '회사는 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다. Supabase Inc. — 데이터베이스 및 인증 서비스 운영, Google LLC — OAuth 인증 서비스, Vercel Inc. — 서비스 호스팅 및 배포, Anthropic PBC — AI 분석 서비스(처리된 이미지 데이터), OpenAI — TTS 음성 합성 서비스.',
          },
          {
            title: '제6조 (정보주체의 권리·의무 및 그 행사방법)',
            body: '정보주체는 회사에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다. 권리 행사는 회사에 대해 서면, 전화, 전자우편 등을 통하여 하실 수 있으며 회사는 이에 대해 지체없이 조치하겠습니다.',
          },
          {
            title: '제7조 (처리하는 개인정보의 안전성 확보 조치)',
            body: '회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다. (1) 개인정보 취급 직원의 최소화 및 교육, (2) 개인정보에 대한 접근 제한, (3) 개인정보를 저장하는 데이터베이스 시스템에 대한 접근권한 관리, (4) 개인정보 처리시스템 등의 접근권한의 제한, (5) 접속기록의 보관 및 위·변조 방지.',
          },
          {
            title: '제8조 (개인정보 보호책임자)',
            body: '회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 개인정보 보호책임자를 지정하고 있습니다. 개인정보 보호책임자: 김정호 (hello@mimicflow.com).',
          },
          {
            title: '제9조 (개인정보 처리방침 변경)',
            body: '이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.',
          },
        ].map(section => (
          <section key={section.title} style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 500, color: '#111827', margin: '0 0 10px' }}>{section.title}</h2>
            <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.8, margin: 0 }}>{section.body}</p>
          </section>
        ))}

        <div style={{ marginTop: '48px', padding: '20px 24px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', fontSize: '13px', color: '#6B7280' }}>
          개인정보 관련 문의: <a href="mailto:hello@mimicflow.com" style={{ color: '#4F46E5', fontWeight: 500 }}>hello@mimicflow.com</a> · 회사명: 코마인드웍스
        </div>
      </main>
    </div>
  );
}

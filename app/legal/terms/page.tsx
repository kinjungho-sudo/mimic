import Link from 'next/link';

import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '이용약관',
  description: 'MIMIC 서비스 이용 시 적용되는 약관과 규정을 안내합니다.',
};

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <header style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '0 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/landingpage" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mimic-logo-2-2.png" alt="MIMIC" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} />
          </Link>
          <Link href="/auth/signup" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>← 회원가입으로 돌아가기</Link>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 500, margin: '0 0 8px', color: '#111827' }}>이용약관</h1>
        <p style={{ fontSize: '13.5px', color: '#6B7280', margin: '0 0 40px' }}>최종 수정일: 2026년 5월 27일 · 시행일: 2026년 5월 27일</p>

        {[
          {
            title: '제1조 (목적)',
            body: '이 약관은 코마인드웍스(이하 "회사")가 제공하는 MIMIC 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.',
          },
          {
            title: '제2조 (정의)',
            body: '"서비스"란 회사가 제공하는 AI 인터랙티브 매뉴얼 제작 플랫폼 MIMIC 및 관련 제반 서비스를 의미합니다. "이용자"란 이 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다. "회원"이란 회사에 개인정보를 제공하여 회원 등록을 한 자로서, 회사의 정보를 지속적으로 제공받으며 서비스를 계속적으로 이용할 수 있는 자를 말합니다.',
          },
          {
            title: '제3조 (약관의 효력 및 변경)',
            body: '이 약관은 서비스를 이용하고자 하는 모든 이용자에 대하여 그 효력을 발생합니다. 회사는 합리적인 사유가 발생할 경우에는 이 약관을 변경할 수 있으며, 약관이 변경되는 경우 회사는 변경사항을 시행일자 7일 전부터 서비스 내 공지사항에 게시합니다.',
          },
          {
            title: '제4조 (서비스의 제공)',
            body: '회사는 다음과 같은 서비스를 제공합니다. (1) AI 기반 인터랙티브 매뉴얼 자동 생성 서비스, (2) Chrome 확장 프로그램(MIMIC Recorder)을 통한 화면 캡처 및 매뉴얼 제작 서비스, (3) 제작된 매뉴얼의 공유 및 플레이어 서비스, (4) 기타 회사가 추가 개발하거나 다른 회사와의 제휴 계약 등을 통해 이용자에게 제공하는 일체의 서비스.',
          },
          {
            title: '제5조 (이용요금)',
            body: '서비스의 기본 이용은 무료입니다. 단, 일부 고급 기능(Pro 플랜)은 유료로 제공될 수 있으며, 유료 전환 전 별도로 안내합니다. 무료 플랜의 경우 일일 매뉴얼 생성 건수가 제한될 수 있습니다.',
          },
          {
            title: '제6조 (회원가입)',
            body: '이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는 의사표시를 함으로써 회원가입을 신청합니다. 회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다.',
          },
          {
            title: '제7조 (개인정보 보호)',
            body: '회사는 이용자의 개인정보를 중요시하며, 개인정보 처리방침에 따라 이용자의 개인정보를 보호합니다. 개인정보와 관련한 사항은 별도의 개인정보 처리방침을 따릅니다.',
          },
          {
            title: '제8조 (이용자의 의무)',
            body: '이용자는 다음 행위를 하여서는 안 됩니다: (1) 신청 또는 변경 시 허위 내용의 등록, (2) 타인의 정보 도용, (3) 회사가 게시한 정보의 변경, (4) 회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등)의 송신 또는 게시, (5) 회사 기타 제3자의 저작권 등 지적재산권에 대한 침해, (6) 회사 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위.',
          },
          {
            title: '제9조 (서비스 중단)',
            body: '회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신두절 또는 운영상 상당한 이유가 있는 경우 서비스의 제공을 일시적으로 중단할 수 있습니다. 서비스 중단의 경우에는 회사가 사전에 통지하며, 불가피한 경우 사후에 통지할 수 있습니다.',
          },
          {
            title: '제10조 (분쟁해결)',
            body: '회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여 처리절차를 운영합니다. 회사와 이용자 간에 발생한 전자상거래 분쟁에 관한 소송은 서울중앙지방법원을 전속관할로 합니다.',
          },
        ].map(section => (
          <section key={section.title} style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 500, color: '#111827', margin: '0 0 10px' }}>{section.title}</h2>
            <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.8, margin: 0 }}>{section.body}</p>
          </section>
        ))}

        <div style={{ marginTop: '48px', padding: '20px 24px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', fontSize: '13px', color: '#6B7280' }}>
          문의: <a href="mailto:hello@mimicflow.com" style={{ color: '#4F46E5', fontWeight: 500 }}>hello@mimicflow.com</a> · 회사명: 코마인드웍스
        </div>
      </main>
    </div>
  );
}

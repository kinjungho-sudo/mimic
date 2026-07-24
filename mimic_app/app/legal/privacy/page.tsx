import Link from 'next/link';
import { BackLink } from '../BackLink';
import { BrandMark } from '@/components/common/BrandMark';
import { BRAND_COLORS, BRAND_NAME, BRAND_SUPPORT_EMAIL, isSearchIndexingEnabled } from '@/lib/brand';

import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '개인정보 처리방침',
  description: `${BRAND_NAME} 서비스의 개인정보 수집·이용·보관 및 파기에 관한 방침을 안내합니다.`,
  alternates: { canonical: '/legal/privacy' },
  robots: {
    index: isSearchIndexingEnabled(),
    follow: isSearchIndexingEnabled(),
  },
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <header style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '0 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/landingpage" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            <BrandMark size={28} />
          </Link>
          <BackLink />
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 500, margin: '0 0 8px', color: '#111827' }}>개인정보 처리방침</h1>
        <p style={{ fontSize: '13.5px', color: '#6B7280', margin: '0 0 24px' }}>최종 수정일: 2026년 7월 16일 · 시행일: 2026년 7월 16일</p>

        <div style={{ margin: '0 0 40px', padding: '18px 20px', background: '#E8FFF7', border: '1px solid #BDEDE2', borderRadius: '12px', fontSize: '13.5px', color: '#164E47', lineHeight: 1.8 }}>
          이 방침은 Parro 웹 서비스와 Chrome 확장 프로그램 <strong>Parro Recorder</strong>에 적용됩니다. Parro Recorder의 화면·웹 활동 수집 범위와 처리 방법은 아래 제3조와 제4조에서 확인할 수 있습니다.
        </div>

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
            title: '제3조 (Parro Recorder가 처리하는 정보)',
            body: 'Parro Recorder는 사용자가 직접 녹화를 시작한 동안에만 다음 정보를 처리합니다. (1) 선택한 탭·창·화면의 스크린샷, (2) 녹화 중인 페이지의 URL과 제목, (3) 클릭한 요소의 정보, 선택자, 좌표와 시각, 페이지 이동 등 사용자 활동, (4) 매뉴얼 단계 생성에 필요한 일반 입력 내용 및 입력 화면. 비밀번호 입력란과 비밀번호로 식별되는 필드의 값은 저장하지 않습니다. 입력 내용은 캡처 화면에 보일 수 있으므로 민감정보가 있는 페이지는 녹화하지 않거나 제공되는 블러 기능을 사용해야 합니다. 사용자가 음성 설명 기능을 켜고 마이크 권한을 허용한 경우에만 마이크 음성을 처리합니다. 확장 프로그램과 Parro 계정을 연결하기 위한 세션 토큰, 계정 식별자 및 확장 프로그램 설정도 처리합니다. 데스크톱 캡처 기능을 사용하는 경우 사용자가 선택한 데스크톱 화면과 동작 정보가 동일한 목적으로 처리됩니다.',
          },
          {
            title: '제4조 (Parro Recorder 정보의 이용·저장·전송)',
            body: '회사는 Recorder가 수집한 정보를 단계별 매뉴얼 생성, AI 제목·설명 생성, 선택적 음성 전사·합성, Live Guide 대상 요소 식별 및 사용자가 요청한 서비스 제공에만 사용합니다. 녹화 단계와 전송 전 임시 데이터, 계정 연동 토큰 및 설정은 chrome.storage.local 등 사용자 기기에 저장될 수 있습니다. 캡처 이미지·음성·단계 정보는 HTTPS를 통해 Parro 서버와 Supabase 저장소로 전송되며, AI 처리에 필요한 최소 범위의 데이터는 Anthropic 및 OpenAI에 전송됩니다. 수집한 데이터를 판매하거나 맞춤형·리타게팅 광고에 사용하지 않습니다. 사용자의 명시적 동의, 보안 조사 또는 법적 의무 등 허용된 경우를 제외하고 사람이 사용자 데이터를 읽도록 허용하지 않습니다.',
          },
          {
            title: '제5조 (개인정보의 처리 및 보유기간)',
            body: '회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다. 회원 탈퇴 또는 삭제 요청 시 지체없이 파기합니다. 단, 관계 법령에 의해 보존할 필요가 있는 경우 해당 기간 동안 보존합니다. Recorder의 녹화 완료 또는 취소 후 전송 전 로컬 임시 데이터는 삭제하며, 계정 연동 토큰과 설정은 사용자가 연동을 해제하거나 확장 프로그램 데이터를 삭제할 때까지 기기에 보관될 수 있습니다.',
          },
          {
            title: '제6조 (개인정보의 제3자 제공)',
            body: '회사는 정보주체의 개인정보를 제1조와 제4조에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조에 해당하는 경우를 제외하고 개인정보를 제3자에게 판매하거나 제공하지 않습니다. 서비스 제공에 필요한 수탁업체의 처리는 제7조에 따릅니다.',
          },
          {
            title: '제7조 (개인정보처리의 위탁)',
            body: '회사는 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다. Supabase Inc. — 데이터베이스, 인증 및 파일 저장 서비스 운영, Google LLC — OAuth 인증 서비스, Vercel Inc. — 서비스 호스팅 및 배포, Anthropic PBC — AI 이미지 분석 및 텍스트 생성, OpenAI — 음성 전사 및 음성 합성 서비스.',
          },
          {
            title: '제8조 (정보주체의 권리·의무 및 그 행사방법)',
            body: '정보주체는 회사에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다. 권리 행사는 회사에 대해 서면, 전화, 전자우편 등을 통하여 하실 수 있으며 회사는 이에 대해 지체없이 조치하겠습니다.',
          },
          {
            title: '제9조 (처리하는 개인정보의 안전성 확보 조치)',
            body: '회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다. (1) 개인정보 취급 직원의 최소화 및 교육, (2) 개인정보에 대한 접근 제한, (3) 개인정보를 저장하는 데이터베이스 시스템에 대한 접근권한 관리, (4) 개인정보 처리시스템 등의 접근권한의 제한, (5) 접속기록의 보관 및 위·변조 방지.',
          },
          {
            title: '제10조 (개인정보 보호책임자)',
            body: `회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 개인정보 보호책임자를 지정하고 있습니다. 개인정보 보호책임자: 김정호 (${BRAND_SUPPORT_EMAIL}).`,
          },
          {
            title: '제11조 (개인정보 처리방침 변경)',
            body: '이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.',
          },
        ].map(section => (
          <section key={section.title} style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 500, color: '#111827', margin: '0 0 10px' }}>{section.title}</h2>
            <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.8, margin: 0 }}>{section.body}</p>
          </section>
        ))}

        <div style={{ marginTop: '48px', padding: '20px 24px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', fontSize: '13px', color: '#6B7280' }}>
          개인정보 관련 문의: <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} style={{ color: BRAND_COLORS.primary, fontWeight: 500 }}>{BRAND_SUPPORT_EMAIL}</a> · 회사명: 코마인드웍스
        </div>
      </main>
    </div>
  );
}

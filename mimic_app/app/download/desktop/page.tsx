import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/components/common/BrandMark';

export const metadata: Metadata = {
  title: 'Parro Desktop 다운로드',
  description: 'Windows 앱의 클릭 과정을 자동으로 캡처하는 Parro Desktop 프리뷰를 다운로드하세요.',
};

const INSTALLER_URL = '/downloads/ParroDesktopSetup.exe';

function WindowsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M3 5.2 10.4 4v7H3V5.2Zm8.4-1.35L21 2.3V11h-9.6V3.85ZM3 12h7.4v7L3 17.8V12Zm8.4 0H21v8.7l-9.6-1.55V12Z" />
    </svg>
  );
}

export default function DesktopDownloadPage() {
  return (
    <main className="page">
      <header>
        <Link className="brand" href="/landingpage"><BrandMark /><span>Parro</span></Link>
        <Link className="back" href="/landingpage">웹으로 돌아가기</Link>
      </header>

      <section className="hero">
        <div className="eyebrow">PARRO DESKTOP · WINDOWS PREVIEW</div>
        <h1>브라우저 밖의 업무도<br />클릭만 하면 기록됩니다</h1>
        <p className="lead">Word, Excel, 사내 프로그램처럼 브라우저 밖에서 진행하는 업무를 클릭 단위 스크린샷으로 캡처해 보세요.</p>

        <div className="downloadCard">
          <div className="platform">
            <div className="platformInfo">
              <span className="windows"><WindowsIcon /></span>
              <div><strong>Windows</strong><span>Preview 0.1.0 · 2026년 7월 14일</span><span>Windows 10/11 · 64-bit · 약 25MB</span></div>
            </div>
            <a data-testid="desktop-download" className="download" href={INSTALLER_URL} download="ParroDesktopSetup.exe">
              <span>↓</span> Windows용 다운로드
            </a>
          </div>
          <div className="facts"><span>로그인 없이 다운로드</span><span>설치 후 바로 실행</span><span>캡처 파일은 내 PC에 저장</span></div>
        </div>
      </section>

      <section className="how">
        <div className="sectionTitle"><span>HOW IT WORKS</span><h2>설치부터 첫 캡처까지 1분</h2><p>웹 확장 프로그램 없이 Parro Desktop만으로 먼저 테스트할 수 있습니다.</p></div>
        <div className="steps">
          <article><b>01</b><h3>다운로드하고 설치</h3><p>위 버튼으로 받은 EXE를 실행합니다. 현재 프리뷰는 코드 서명 전이므로 Windows 경고가 보이면 ‘추가 정보 → 실행’을 선택하세요.</p></article>
          <article><b>02</b><h3>Start capture</h3><p>Parro Desktop Capture 창에서 시작 버튼을 누른 뒤 평소처럼 Windows 앱을 클릭하세요.</p></article>
          <article><b>03</b><h3>Stop 후 결과 확인</h3><p>중지 버튼을 누르고 Open folder에서 PNG 스크린샷, 클릭 좌표와 시간 기록을 확인하세요.</p></article>
        </div>
      </section>

      <section className="preview">
        <div><span>PREVIEW</span><h2>지금 저장되는 항목</h2><p>왼쪽 클릭 시점의 전체 화면 PNG, 클릭 좌표, 화면 크기, 캡처 시간이 로컬 세션 폴더에 저장됩니다.</p></div>
        <code>%LOCALAPPDATA%\MIMIC\DesktopCompanion\captures</code>
      </section>

      <footer><div className="brand"><BrandMark size={27} /><span>Parro Desktop</span></div><span>Windows Preview · 코드 서명 전 테스트 버전</span></footer>

      <style>{`
        *{box-sizing:border-box}.page{min-height:100vh;background:#071411;color:#f5fffd;font-family:Arial,'Noto Sans KR',sans-serif}header{height:72px;max-width:1160px;margin:auto;padding:0 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}.brand{display:inline-flex;align-items:center;gap:9px;color:inherit;text-decoration:none;font-weight:800}.back{color:rgba(255,255,255,.62);font-size:14px;text-decoration:none}.hero{position:relative;overflow:hidden;max-width:1160px;margin:auto;padding:96px 28px 90px;text-align:center}.hero:before{content:'';position:absolute;width:620px;height:620px;right:-250px;top:-380px;border-radius:50%;background:radial-gradient(circle,rgba(0,169,157,.3),transparent 67%)}.eyebrow{position:relative;display:inline-flex;padding:8px 12px;border:1px solid rgba(0,169,157,.35);border-radius:999px;background:rgba(0,169,157,.08);color:#73e7dc;font-size:11px;font-weight:800;letter-spacing:.14em}h1{position:relative;margin:28px 0 20px;font-size:clamp(44px,7vw,76px);line-height:1.04;letter-spacing:-.055em}.lead{position:relative;max-width:650px;margin:auto;color:rgba(229,255,250,.64);font-size:18px;line-height:1.75;word-break:keep-all}.downloadCard{position:relative;max-width:860px;margin:52px auto 0;padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:rgba(255,255,255,.055);box-shadow:0 28px 80px rgba(0,0,0,.32)}.platform{min-height:132px;padding:24px 26px;border-radius:15px;background:#f8fffd;color:#10231f;display:flex;align-items:center;justify-content:space-between;gap:24px;text-align:left}.platformInfo{display:flex;align-items:center;gap:16px}.windows{width:50px;height:50px;border-radius:13px;display:grid;place-items:center;background:#e8f8f4;color:#007c72}.platformInfo div{display:flex;flex-direction:column;gap:5px}.platformInfo strong{font-size:19px}.platformInfo span{color:#64746f;font-size:12.5px}.download{min-height:52px;padding:0 22px;border-radius:12px;display:inline-flex;align-items:center;gap:9px;background:#007c72;color:white;text-decoration:none;font-size:14px;font-weight:800;white-space:nowrap;box-shadow:0 8px 22px rgba(0,124,114,.22);transition:.15s}.download:hover{transform:translateY(-2px);background:#00675f}.facts{display:flex;flex-wrap:wrap;justify-content:center;gap:22px;padding:15px 16px 6px;color:rgba(228,255,249,.62);font-size:12px}.how{padding:94px 28px 108px;background:#f5faf8;color:#10231f}.sectionTitle{max-width:700px;margin:0 auto 48px;text-align:center}.sectionTitle>span,.preview>div>span{color:#008e86;font-size:11px;font-weight:900;letter-spacing:.16em}.sectionTitle h2,.preview h2{margin:14px 0 12px;font-size:36px;letter-spacing:-.035em}.sectionTitle p,.preview p{margin:0;color:#62716d;line-height:1.7}.steps{max-width:1050px;margin:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.steps article{min-height:242px;padding:28px;border:1px solid #dfeae6;border-radius:18px;background:white;box-shadow:0 10px 30px rgba(12,61,52,.045)}.steps b{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#e6f7f3;color:#007c72;font-size:12px}.steps h3{margin:24px 0 10px;font-size:20px}.steps p{margin:0;color:#64746f;font-size:14px;line-height:1.75;word-break:keep-all}.preview{max-width:1050px;margin:auto;padding:72px 28px;display:flex;align-items:center;justify-content:space-between;gap:42px}.preview>div{max-width:640px}.preview>div>span{display:inline-flex;padding:6px 9px;border-radius:7px;background:rgba(141,214,63,.13);color:#aeea65}.preview code{max-width:390px;padding:18px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.06);color:#8ce5dc;font-size:12px;overflow-wrap:anywhere}footer{min-height:86px;max-width:1104px;margin:auto;padding:0 28px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;color:rgba(255,255,255,.42);font-size:12px}footer .brand{color:rgba(255,255,255,.72);font-size:14px}@media(max-width:760px){header{height:64px;padding:0 20px}.hero{padding:70px 20px}.lead{font-size:16px}.platform{align-items:stretch;flex-direction:column}.download{justify-content:center}.how{padding:70px 20px}.sectionTitle h2,.preview h2{font-size:30px}.steps{grid-template-columns:1fr}.preview{padding:60px 20px;flex-direction:column;align-items:stretch}footer{padding:24px 20px;flex-direction:column;align-items:flex-start;justify-content:center;gap:10px}}
      `}</style>
    </main>
  );
}

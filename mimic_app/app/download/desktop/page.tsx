import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Parro Desktop 다운로드',
  description: 'Windows 앱의 클릭 과정을 자동으로 캡처하는 Parro Desktop 프리뷰를 다운로드하세요.',
};

const INSTALLER_URL = '/downloads/ParroDesktopSetup.exe';

function ParroMark({ size = 34 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 128 128" width={size} height={size}>
      <path d="M69 55C50 40 28 34 11 14c5 25 22 43 53 51l5-10Z" fill="#00A99D" />
      <path d="M67 63C43 53 23 51 7 38c8 23 27 34 57 33l3-8Z" fill="#008E86" />
      <path d="M69 69C46 65 29 68 15 62c12 18 31 20 54 14v-7Z" fill="#8DD63F" />
      <circle cx="72" cy="70" r="14" fill="#fff" stroke="#8DD63F" strokeWidth="6" />
      <circle cx="72" cy="70" r="7" fill="none" stroke="#00A99D" strokeWidth="3" />
      <path d="m69 64 37 15-16 6-8 22-13-43Z" fill="#102033" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M3 5.2 10.4 4v7H3V5.2Zm8.4-1.35L21 2.3V11h-9.6V3.85ZM3 12h7.4v7L3 17.8V12Zm8.4 0H21v8.7l-9.6-1.55V12Z" />
    </svg>
  );
}

export default function DesktopDownloadPage() {
  return (
    <main className="download-page">
      <header className="site-header">
        <Link className="brand" href="/landingpage" aria-label="Parro 홈">
          <ParroMark />
          <span>Parro</span>
        </Link>
        <Link className="header-link" href="/help#desktop-companion">도움말</Link>
      </header>

      <section className="hero">
        <div className="glow glow-a" />
        <div className="glow glow-b" />
        <div className="hero-copy">
          <span className="eyebrow">PARRO DESKTOP · WINDOWS PREVIEW</span>
          <h1>웹 밖의 업무도<br />클릭만 하면 기록됩니다</h1>
          <p>
            Word, Excel, 사내 프로그램처럼 브라우저 밖에서 진행하는 업무를
            클릭 단위 스크린샷으로 캡처하세요.
          </p>
        </div>

        <div className="download-card">
          <div className="platform-row">
            <div className="platform-main">
              <span className="windows-icon"><WindowsIcon /></span>
              <div>
                <strong>Windows</strong>
                <span>Preview 0.3.1 · 2026년 7월 16일</span>
                <span>Windows 10/11 · 64-bit · 약 34MB</span>
              </div>
            </div>
            <a
              className="download-button"
              data-testid="desktop-download"
              href={INSTALLER_URL}
              download="ParroDesktopSetup.exe"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12m0 0 5-5m-5 5-5-5" />
                <path d="M5 21h14" />
              </svg>
              Windows용 다운로드
            </a>
          </div>
          <div className="trust-row">
            <span>✓ 로그인 후 다운로드</span>
            <span>✓ 설치 후 바로 실행</span>
            <span>✓ 캡처 파일은 PC에 저장</span>
          </div>
        </div>
      </section>

      <section className="steps-section">
        <div className="section-heading">
          <span>HOW IT WORKS</span>
          <h2>설치부터 첫 캡처까지 1분</h2>
          <p>브라우저 확장 없이 Parro Desktop만으로 먼저 테스트할 수 있습니다.</p>
        </div>
        <div className="steps-grid">
          {[
            ['01', '다운로드하고 설치', '설치 파일을 실행하면 바탕화면과 시작 메뉴에 Parro Desktop Capture가 추가됩니다.'],
            ['02', '캡처 툴바로 기록', '캡처 시작을 누르면 화면 상단 중앙에 작은 Parro 툴바가 열립니다. 이 툴바는 결과 스크린샷에서 제외됩니다.'],
            ['03', '완료 후 결과 확인', '수동 캡처·블러·실행 취소·일시정지를 사용하고 완료를 누르면 로컬 결과 폴더가 열립니다.'],
          ].map(([number, title, body]) => (
            <article className="step-card" key={number}>
              <span className="step-number">{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <div className="brand"><ParroMark size={28} /><span>Parro Desktop</span></div>
        <span>Windows Preview · 코드 서명 전 내부 테스트 버전</span>
      </footer>

      <style>{`
        * { box-sizing: border-box; }
        .download-page { min-height: 100vh; background: #071411; color: #f5fffd; font-family: Arial, 'Noto Sans KR', sans-serif; }
        .site-header { height: 72px; max-width: 1160px; margin: 0 auto; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.08); }
        .brand { display: inline-flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; font-size: 17px; font-weight: 800; letter-spacing: -.02em; }
        .header-link { color: rgba(255,255,255,.62); text-decoration: none; font-size: 14px; }
        .hero { position: relative; overflow: hidden; max-width: 1160px; margin: 0 auto; padding: 100px 28px 92px; }
        .glow { position: absolute; border-radius: 999px; filter: blur(1px); pointer-events: none; }
        .glow-a { width: 580px; height: 580px; top: -340px; right: -120px; background: radial-gradient(circle, rgba(0,169,157,.28), transparent 68%); }
        .glow-b { width: 420px; height: 420px; left: -260px; bottom: -180px; background: radial-gradient(circle, rgba(141,214,63,.13), transparent 68%); }
        .hero-copy { position: relative; max-width: 780px; margin: 0 auto; text-align: center; }
        .eyebrow { display: inline-flex; padding: 8px 12px; border: 1px solid rgba(0,169,157,.35); border-radius: 999px; background: rgba(0,169,157,.08); color: #73e7dc; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
        h1 { margin: 28px 0 20px; font-size: clamp(44px, 7vw, 76px); line-height: 1.04; letter-spacing: -.055em; }
        .hero-copy p { max-width: 650px; margin: 0 auto; color: rgba(229,255,250,.64); font-size: 18px; line-height: 1.75; word-break: keep-all; }
        .download-card { position: relative; max-width: 850px; margin: 54px auto 0; padding: 10px; border: 1px solid rgba(255,255,255,.12); border-radius: 22px; background: rgba(255,255,255,.055); box-shadow: 0 28px 80px rgba(0,0,0,.32); backdrop-filter: blur(18px); }
        .platform-row { min-height: 132px; padding: 24px 26px; border-radius: 15px; background: #f8fffd; color: #10231f; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .platform-main { display: flex; align-items: center; gap: 16px; }
        .windows-icon { width: 48px; height: 48px; border-radius: 13px; display: grid; place-items: center; background: #e8f8f4; color: #007c72; }
        .platform-main div { display: flex; flex-direction: column; gap: 5px; }
        .platform-main strong { font-size: 19px; }
        .platform-main span { color: #64746f; font-size: 12.5px; }
        .download-button { min-height: 52px; padding: 0 22px; border-radius: 12px; display: inline-flex; align-items: center; gap: 9px; background: #007c72; color: white; text-decoration: none; font-size: 14px; font-weight: 800; box-shadow: 0 8px 22px rgba(0,124,114,.22); transition: transform .15s, background .15s; }
        .download-button:hover { transform: translateY(-2px); background: #00675f; }
        .trust-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 22px; padding: 15px 16px 6px; color: rgba(228,255,249,.62); font-size: 12px; }
        .steps-section { padding: 96px 28px 110px; background: #f5faf8; color: #10231f; }
        .section-heading { max-width: 700px; margin: 0 auto 48px; text-align: center; }
        .section-heading > span { color: #008e86; font-size: 11px; font-weight: 900; letter-spacing: .16em; }
        .section-heading h2 { margin: 14px 0 12px; font-size: 36px; letter-spacing: -.035em; }
        .section-heading p { margin: 0; color: #62716d; line-height: 1.7; }
        .steps-grid { max-width: 1050px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .step-card { min-height: 238px; padding: 28px; border: 1px solid #dfeae6; border-radius: 18px; background: white; box-shadow: 0 10px 30px rgba(12,61,52,.045); }
        .step-number { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: #e6f7f3; color: #007c72; font-size: 12px; font-weight: 900; }
        .step-card h3 { margin: 24px 0 10px; font-size: 20px; letter-spacing: -.02em; }
        .step-card p { margin: 0; color: #64746f; font-size: 14px; line-height: 1.75; word-break: keep-all; }
        footer { min-height: 86px; max-width: 1104px; margin: 0 auto; padding: 0 28px; border-top: 1px solid rgba(255,255,255,.08); display: flex; align-items: center; justify-content: space-between; color: rgba(255,255,255,.42); font-size: 12px; }
        footer .brand { color: rgba(255,255,255,.72); font-size: 14px; }
        @media (max-width: 760px) {
          .site-header { height: 64px; padding: 0 20px; }
          .hero { padding: 72px 20px 70px; }
          h1 { font-size: 44px; }
          .hero-copy p { font-size: 16px; }
          .download-card { margin-top: 38px; }
          .platform-row { align-items: stretch; flex-direction: column; }
          .download-button { justify-content: center; width: 100%; }
          .trust-row { justify-content: flex-start; gap: 8px 16px; }
          .steps-section { padding: 72px 20px; }
          .section-heading h2 { font-size: 30px; }
          .steps-grid { grid-template-columns: 1fr; }
          footer { padding: 24px 20px; align-items: flex-start; flex-direction: column; justify-content: center; gap: 10px; }
        }
      `}</style>
    </main>
  );
}

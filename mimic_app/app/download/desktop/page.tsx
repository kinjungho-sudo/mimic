import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './page.module.css';
import { DownloadButton } from './DownloadButton';

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
    <main className={styles.downloadPage}>
      <header className={styles.siteHeader}>
        <Link className={styles.brand} href="/landingpage" aria-label="Parro 홈">
          <ParroMark />
          <span>Parro</span>
        </Link>
        <Link className={styles.headerLink} href="/help#desktop-companion">도움말</Link>
      </header>

      <section className={styles.hero}>
        <div className={`${styles.glow} ${styles.glowA}`} />
        <div className={`${styles.glow} ${styles.glowB}`} />
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>PARRO DESKTOP · WINDOWS PREVIEW</span>
          <h1>웹 밖의 업무도<br />클릭만 하면 기록됩니다</h1>
          <p>
            Word, Excel, 사내 프로그램처럼 브라우저 밖에서 진행하는 업무를
            클릭 단위 스크린샷으로 캡처하세요.
          </p>
        </div>

        <div className={styles.downloadCard}>
          <div className={styles.platformRow}>
            <div className={styles.platformMain}>
              <span className={styles.windowsIcon}><WindowsIcon /></span>
              <div>
                <strong>Windows</strong>
                <span>Preview 0.5.0 · 2026년 7월 19일</span>
                <span>Windows 10/11 · 64-bit · 약 34MB</span>
              </div>
            </div>
            <DownloadButton href={INSTALLER_URL} />
          </div>
          <div className={styles.trustRow}>
            <span>✓ 로그인 후 다운로드</span>
            <span>✓ 설치 후 바로 실행</span>
            <span>✓ 캡처 파일은 PC에 저장</span>
          </div>
        </div>
      </section>

      <section className={styles.stepsSection}>
        <div className={styles.sectionHeading}>
          <span>HOW IT WORKS</span>
          <h2>설치부터 첫 캡처까지 1분</h2>
          <p>브라우저 확장 없이 Parro Desktop만으로 먼저 테스트할 수 있습니다.</p>
        </div>
        <div className={styles.stepsGrid}>
          {[
            ['01', '다운로드하고 설치', '설치 파일을 실행하면 바탕화면과 시작 메뉴에 Parro Desktop Capture가 추가됩니다.'],
            ['02', '캡처 툴바로 기록', '캡처 시작을 누르면 화면 상단 중앙에 작은 Parro 툴바가 열립니다. 이 툴바는 결과 스크린샷에서 제외됩니다.'],
            ['03', '완료 후 결과 확인', '수동 캡처·블러·실행 취소·일시정지를 사용하고 완료를 누르면 로컬 결과 폴더가 열립니다.'],
          ].map(([number, title, body]) => (
            <article className={styles.stepCard} key={number}>
              <span className={styles.stepNumber}>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.brand}><ParroMark size={28} /><span>Parro Desktop</span></div>
        <span>Windows Preview · 코드 서명 전 내부 테스트 버전</span>
      </footer>
    </main>
  );
}

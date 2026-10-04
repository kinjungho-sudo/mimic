import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import styles from './page.module.css';
import { DownloadButton } from './DownloadButton';
import { hasEntitlement } from '@/lib/entitlements';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Parro Desktop 다운로드',
  description: '데스크톱 녹화를 시작하기 위해 필요한 Parro Desktop 설치 파일을 다운로드하세요.',
};

const INSTALLER_URL = '/downloads/ParroDesktopSetup.exe';

export const dynamic = 'force-dynamic';

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

export default async function DesktopDownloadPage({
  searchParams,
}: {
  searchParams?: { source?: string; reason?: string; installedVersion?: string };
}) {
  const supabase = await createServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null;
  const source = searchParams?.source || 'download-page';

  if (!userId) {
    const next = `/download/desktop?source=${encodeURIComponent(source)}`;
    redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  const service = createServiceRoleClient();
  const { data: profile } = await service
    .from('mm_users')
    .select('plan')
    .eq('id', userId)
    .single();

  if (!hasEntitlement(profile?.plan, 'desktop_companion')) {
    redirect(`/landingpage?feature=desktop&source=${encodeURIComponent(source)}#pricing`);
  }

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
        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>PARRO DESKTOP 설치</span>
            <h1>설치가 필요해요</h1>
            <p>
              데스크톱 녹화를 시작하려면 Windows용 Parro Desktop 앱이 필요합니다.
              자동 설치로 바로 진행하거나, 설치 파일만 로컬에 내려받을 수 있어요.
            </p>
            <div className={styles.captureFlow} aria-label="Parro Desktop 작업 흐름">
              <span><b>01</b> 다운로드</span>
              <i aria-hidden="true">→</i>
              <span><b>02</b> 설치</span>
              <i aria-hidden="true">→</i>
              <span><b>03</b> 녹화 시작</span>
            </div>
          </div>

          <div className={styles.downloadCard}>
            <div className={styles.cardTopline}>
              <span className={styles.liveDot} />
              <span>Windows 설치 파일</span>
              <span className={styles.previewTag}>PREVIEW</span>
            </div>
            <div className={styles.platformRow}>
              <div className={styles.platformMain}>
                <span className={styles.windowsIcon}><WindowsIcon /></span>
                <div>
                  <strong>Parro Desktop</strong>
                  <span>Windows 10/11 · 64-bit</span>
                  <span>Preview 0.6.7 · 약 34MB</span>
                </div>
              </div>
              <DownloadButton
                href={INSTALLER_URL}
                reason={searchParams?.reason}
                requestedInstalledVersion={searchParams?.installedVersion}
                source={source}
              />
            </div>
            <div className={styles.trustRow}>
              <span><b>✓</b> 자동 설치로 바로 진행</span>
              <span><b>✓</b> 설치 파일 다운로드 가능</span>
              <span><b>✓</b> 유료 플랜 전용</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.stepsSection}>
        <div className={styles.sectionHeading}>
          <span>INSTALL STEPS</span>
          <h2>설치 방법</h2>
          <p>복잡한 설명 없이 아래 순서대로만 진행하면 됩니다.</p>
        </div>
        <div className={styles.stepsGrid}>
          {[
            ['01', '자동 설치 또는 파일 다운로드', '자동 설치를 누르면 설치 파일을 바로 받고 설치 완료를 감지합니다. 파일만 필요하면 설치 파일 다운로드를 선택하세요.'],
            ['02', '기본 옵션으로 설치', 'ParroDesktopSetup.exe가 열리면 안내에 따라 기본 옵션 그대로 설치합니다.'],
            ['03', '설치 확인 후 앱 실행', '설치가 확인되면 Parro Desktop 앱으로 이동하고 데스크톱 녹화를 시작할 수 있습니다.'],
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

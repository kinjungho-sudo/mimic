'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BRAND_EXTENSION_STORE_URL } from '@/lib/brand';
import {
  DESKTOP_COMPANION_LATEST_VERSION,
  desktopCompanionCompatibility,
  isExtensionConnectionError,
  sendDesktopExtensionMessage,
} from '@/lib/desktop-companion-client';
import styles from './page.module.css';

type InstallState = 'checking' | 'current' | 'outdated' | 'missing' | 'recorder_missing';

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12m0 0 5-5m-5 5-5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function DownloadButton({
  href,
  reason,
  requestedInstalledVersion,
  source,
}: {
  href: string;
  reason?: string;
  requestedInstalledVersion?: string;
  source: string;
}) {
  const locked = useRef(false);
  const [downloading, setDownloading] = useState(false);
  const [installState, setInstallState] = useState<InstallState>('checking');
  const [installedVersion, setInstalledVersion] = useState<string | null>(requestedInstalledVersion || null);
  const [recorderVersion, setRecorderVersion] = useState<string | null>(null);

  const checkInstall = useCallback(async () => {
    setInstallState('checking');
    const response = await sendDesktopExtensionMessage('DESKTOP_COMPANION_STATUS');
    setRecorderVersion(response?.recorderVersion?.trim() || null);
    if (response?.desktop?.connected) {
      const version = response.desktop.version?.trim() || null;
      setInstalledVersion(version);
      setInstallState(desktopCompanionCompatibility(version) === 'current' ? 'current' : 'outdated');
      return;
    }
    if (isExtensionConnectionError(response?.error)) {
      setInstallState('recorder_missing');
      return;
    }
    setInstallState('missing');
  }, []);

  useEffect(() => {
    void checkInstall();
  }, [checkInstall]);

  const handleDownload = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (locked.current) {
      event.preventDefault();
      return;
    }
    locked.current = true;
    setDownloading(true);
    window.setTimeout(() => {
      locked.current = false;
      setDownloading(false);
    }, 4000);
  };

  const downloadLabel = downloading
    ? '다운로드 시작됨'
    : installState === 'outdated' || reason === 'update'
      ? '최신 버전으로 업데이트'
      : 'Windows용 다운로드';
  const downloadLink = (
    <a
      className={styles.downloadButton}
      data-testid="desktop-download"
      data-downloading={downloading ? 'true' : 'false'}
      href={href}
      download="ParroDesktopSetup.exe"
      aria-disabled={downloading}
      onClick={handleDownload}
    >
      <DownloadIcon />
      {downloadLabel}
    </a>
  );

  if (installState === 'checking') {
    return (
      <div className={styles.downloadActionArea} aria-live="polite">
        <button className={styles.checkingButton} type="button" disabled>
          <span className={styles.miniSpinner} />
          설치 상태 확인 중
        </button>
        {reason === 'update' && (
          <span className={styles.actionHint}>
            {installedVersion ? `설치된 ${installedVersion} 버전` : '이전 버전'}을 확인하고 있습니다.
          </span>
        )}
      </div>
    );
  }

  if (installState === 'current') {
    return (
      <div className={styles.downloadActionArea} aria-live="polite">
        <span className={`${styles.installBadge} ${styles.installBadgeReady}`}>
          ✓ 최신 {installedVersion} 설치됨
        </span>
        <a
          className={styles.downloadButton}
          href={`/desktop-setup?source=${encodeURIComponent(source)}&autostart=1`}
        >
          바로 데스크톱 녹화 시작
        </a>
        <a className={styles.secondaryAction} href={href} download="ParroDesktopSetup.exe" onClick={handleDownload}>
          설치 파일 다시 받기
        </a>
      </div>
    );
  }

  return (
    <div className={styles.downloadActionArea} aria-live="polite">
      {installState === 'outdated' && (
        <>
          <span className={`${styles.installBadge} ${styles.installBadgeUpdate}`}>
            업데이트 필요 · {installedVersion ? `현재 ${installedVersion}` : '버전 확인 불가'} → 최신 {DESKTOP_COMPANION_LATEST_VERSION}
          </span>
          {!installedVersion && (
            <span className={styles.actionHint}>
              이전 앱 또는 Recorder는 버전을 전달하지 않습니다. 둘 다 최신 상태인지 확인해주세요.
            </span>
          )}
        </>
      )}
      {installState === 'missing' && (
        <span className={styles.actionHint}>설치되지 않았습니다. 원할 때 설치 파일을 내려받으세요.</span>
      )}
      {installState === 'recorder_missing' && (
        <span className={styles.actionHint}>설치 확인에는 Parro Recorder 확장이 필요합니다.</span>
      )}
      {downloadLink}
      <button className={styles.secondaryActionButton} type="button" onClick={() => { void checkInstall(); }}>
        설치 완료 후 다시 확인
      </button>
      {installState === 'recorder_missing' && (
        <a className={styles.secondaryAction} href={BRAND_EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer">
          Parro Recorder 설치
        </a>
      )}
      {installState === 'outdated' && !installedVersion && !recorderVersion && (
        <a className={styles.secondaryAction} href={BRAND_EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer">
          Parro Recorder도 업데이트
        </a>
      )}
    </div>
  );
}

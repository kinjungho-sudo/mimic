'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BRAND_EXTENSION_STORE_URL } from '@/lib/brand';
import {
  DESKTOP_COMPANION_LATEST_VERSION,
  desktopCompanionCompatibility,
  isExtensionConnectionError,
  sendDesktopExtensionMessage,
} from '@/lib/desktop-companion-client';
import { releaseDesktopDownloadLock, startDesktopDownloadOnce } from '@/lib/desktop-download-once';
import styles from './page.module.css';

type InstallState = 'checking' | 'current' | 'outdated' | 'missing' | 'recorder_missing';
type DownloadIntent = 'setup-start' | 'installer-download';

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
  const activeDownloadButton = useRef<HTMLButtonElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadIntent, setDownloadIntent] = useState<DownloadIntent | null>(null);
  const [autoInstallArmed, setAutoInstallArmed] = useState(false);
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

  useEffect(() => () => {
    releaseDesktopDownloadLock(activeDownloadButton.current);
  }, []);

  useEffect(() => {
    if (!autoInstallArmed || installState !== 'current') return;
    window.location.assign(`/desktop-setup?source=${encodeURIComponent(source)}&autostart=1`);
  }, [autoInstallArmed, installState, source]);

  useEffect(() => {
    if (!autoInstallArmed) return;
    const timerId = window.setInterval(() => {
      void checkInstall();
    }, 2500);
    return () => window.clearInterval(timerId);
  }, [autoInstallArmed, checkInstall]);

  const handleDownload = (intent: DownloadIntent) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const button = event.currentTarget;
    if (intent === 'setup-start') setAutoInstallArmed(true);
    setDownloadIntent(intent);
    const started = startDesktopDownloadOnce(button, {
      href,
      filename: 'ParroDesktopSetup.exe',
      lockMs: 4_000,
      onLockChange: locked => {
        setDownloading(locked);
        if (!locked) setDownloadIntent(null);
        if (!locked && activeDownloadButton.current === button) activeDownloadButton.current = null;
      },
    });
    if (started) activeDownloadButton.current = button;
  };

  const downloadLabel = downloading
    ? downloadIntent === 'setup-start'
      ? '설치 파일 준비 중'
      : '설치 파일 다운로드 중'
    : installState === 'outdated' || reason === 'update'
      ? '업데이트 설치 시작'
      : '설치 시작';
  const autoInstallButton = (
    <button
      type="button"
      className={styles.downloadButton}
      data-testid="desktop-auto-install"
      data-downloading={downloading ? 'true' : 'false'}
      disabled={downloading}
      onClick={handleDownload('setup-start')}
      onDoubleClick={event => event.preventDefault()}
    >
      <DownloadIcon />
      {downloadLabel}
    </button>
  );
  const installerDownloadButton = (
    <button
      type="button"
      className={styles.installerDownloadButton}
      data-testid="desktop-download"
      data-downloading={downloading && downloadIntent === 'installer-download' ? 'true' : 'false'}
      disabled={downloading}
      onClick={handleDownload('installer-download')}
      onDoubleClick={event => event.preventDefault()}
    >
      설치 파일 다운로드
    </button>
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
          Parro Desktop 앱 열기
        </a>
        <button
          className={styles.installerDownloadButton}
          data-testid="desktop-download"
          type="button"
          disabled={downloading}
          onClick={handleDownload('installer-download')}
          onDoubleClick={event => event.preventDefault()}
        >
          설치 파일 다운로드
        </button>
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
        <span className={styles.actionHint}>설치되지 않았습니다. 설치 시작을 누른 뒤 내려받은 파일을 열어 설치해주세요.</span>
      )}
      {installState === 'recorder_missing' && (
        <span className={styles.actionHint}>설치 확인에는 Parro Recorder 확장이 필요합니다.</span>
      )}
      {autoInstallButton}
      {installerDownloadButton}
      <button className={styles.secondaryActionButton} type="button" onClick={() => { void checkInstall(); }}>
        설치 완료 후 다시 확인
      </button>
      {autoInstallArmed && (
        <span className={styles.actionHint}>
          다운로드가 시작되면 <strong>ParroDesktopSetup.exe</strong>를 열어 설치를 완료해주세요. 설치가 확인되면 Parro Desktop 앱으로 바로 이동합니다.
        </span>
      )}
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

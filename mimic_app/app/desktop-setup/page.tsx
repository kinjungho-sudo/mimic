'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BRAND_EXTENSION_STORE_URL } from '@/lib/brand';
import {
  canTalkToDesktopExtension,
  desktopCompanionCompatibility,
  desktopCompanionErrorMessage,
  isExtensionConnectionError,
  sendDesktopExtensionMessage,
} from '@/lib/desktop-companion-client';

const STORE_URL = BRAND_EXTENSION_STORE_URL;
const INSTALLER_URL = process.env.NEXT_PUBLIC_DESKTOP_INSTALLER_URL?.replace(/^\uFEFF/, '').trim()
  || '/downloads/ParroDesktopSetup.exe';

type DesktopStatus = 'idle' | 'checking' | 'ready' | 'missing' | 'extension_missing' | 'launching' | 'started' | 'importing' | 'complete' | 'stopped';

let lastInstallerDownloadAt = 0;

function triggerInstallerDownload(): boolean {
  if (!INSTALLER_URL) return false;
  const now = Date.now();
  if (now - lastInstallerDownloadAt < 4000) return false;
  lastInstallerDownloadAt = now;
  const link = document.createElement('a');
  link.href = INSTALLER_URL;
  link.download = 'ParroDesktopSetup.exe';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

export default function DesktopSetupPage() {
  const [status, setStatus] = useState<DesktopStatus>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [autoInstallArmed, setAutoInstallArmed] = useState(false);
  const initialFlowStarted = useRef(false);

  const installerReady = INSTALLER_URL.length > 0;
  const statusText = useMemo(() => {
    switch (status) {
      case 'checking':
        return '연결 확인 중';
      case 'ready':
        return '설치 완료';
      case 'missing':
        return '설치 필요';
      case 'extension_missing':
        return 'Recorder 필요';
      case 'launching':
        return '앱 여는 중';
      case 'started':
        return '앱 실행됨';
      case 'importing':
        return '가져오는 중';
      case 'complete':
        return '완료';
      case 'stopped':
        return '녹화 종료';
      default:
        return '확인 중';
    }
  }, [status]);

  const handleInstallerDownload = useCallback((mode: 'auto' | 'download') => {
    if (!installerReady) {
      setMessage('아직 정식 .exe 설치 파일 URL이 연결되지 않았습니다. NEXT_PUBLIC_DESKTOP_INSTALLER_URL 설정이 필요합니다.');
      return;
    }
    if (mode === 'auto') setAutoInstallArmed(true);
    const started = triggerInstallerDownload();
    if (!started) {
      setMessage('다운로드가 이미 시작되었습니다. 브라우저의 다운로드 목록을 확인해주세요.');
      return;
    }
    setMessage(mode === 'auto'
      ? '다운로드가 시작됐어요. 설치 파일을 열어 완료하면 앱을 바로 엽니다.'
      : '설치 파일을 다운로드했어요.');
  }, [installerReady]);

  const openDesktopApp = useCallback(async () => {
    setStatus('launching');
    setMessage('Parro Desktop을 여는 중입니다.');
    const response = await sendDesktopExtensionMessage('OPEN_DESKTOP_APP');
    if (response?.ok) {
      setStatus('started');
      setMessage('Parro Desktop 앱이 열렸습니다.');
      return;
    }
    setStatus('ready');
    setMessage(desktopCompanionErrorMessage(response?.error, 'Parro Desktop 앱을 열지 못했습니다.'));
  }, []);

  const checkInstall = useCallback(async (autoStart = false) => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('source') || 'desktop-setup';
    const moveToDownload = (reason: 'install' | 'update', installedVersion?: string | null) => {
      const version = installedVersion ? `&installedVersion=${encodeURIComponent(installedVersion)}` : '';
      window.location.replace(`/download/desktop?source=${encodeURIComponent(source)}&reason=${reason}${version}`);
    };

    if (!canTalkToDesktopExtension()) {
      setStatus('extension_missing');
      setMessage('Parro Recorder 확장을 먼저 연결해주세요.');
      return;
    }

    setStatus('checking');
    setMessage(null);
    const response = await sendDesktopExtensionMessage('DESKTOP_COMPANION_STATUS');

    if (response?.desktop?.connected) {
      const installedVersion = response.desktop.version?.trim() || null;
      if (desktopCompanionCompatibility(installedVersion) !== 'current') {
        moveToDownload('update', installedVersion);
        return;
      }
      if (autoStart) {
        await openDesktopApp();
        return;
      }
      setStatus('ready');
      setMessage(`최신 버전 ${installedVersion}이 설치되어 있습니다.`);
      return;
    }

    if (isExtensionConnectionError(response?.error)) {
      setStatus('extension_missing');
      setMessage('Parro Recorder 확장 연결이 필요합니다.');
      return;
    }

    if (autoStart) {
      moveToDownload('install');
      return;
    }
    setStatus('missing');
    setMessage(response?.desktop?.lastError || 'Parro Desktop 설치가 필요합니다.');
  }, [openDesktopApp]);

  useEffect(() => {
    if (initialFlowStarted.current) return;
    initialFlowStarted.current = true;
    const params = new URLSearchParams(window.location.search);
    const captureSessionId = params.get('session');
    if (captureSessionId && params.get('autoImport') === '1') {
      window.location.replace(`/desktop-import?source=desktop-app&session=${encodeURIComponent(captureSessionId)}`);
      return;
    }
    setPendingSessionId(captureSessionId);
    void checkInstall(params.get('autostart') === '1');
  }, [checkInstall]);

  useEffect(() => {
    if (!autoInstallArmed) return;
    const timerId = window.setInterval(() => {
      void checkInstall(true);
    }, 2500);
    return () => window.clearInterval(timerId);
  }, [autoInstallArmed, checkInstall]);

  const importDesktopCapture = useCallback(async (captureSessionId: string) => {
    if (!captureSessionId) return;
    if (!canTalkToDesktopExtension()) {
      setStatus('extension_missing');
      setMessage('Parro Recorder 확장을 설치하고 계정에 연결한 뒤 다시 시도해주세요. 캡처 파일은 PC에 그대로 보관됩니다.');
      return;
    }
    setStatus('importing');
    setMessage('저장된 데스크톱 캡처를 업로드하고 AI로 제목과 설명을 만드는 중입니다.');
    const response = await sendDesktopExtensionMessage('IMPORT_DESKTOP_CAPTURE', { sessionId: captureSessionId }, 180000);
    if (response?.ok && response.editorUrl) {
      setStatus('complete');
      setMessage(`${response.stepCount || 0}개 단계의 매뉴얼이 만들어졌습니다.`);
      window.location.assign(response.editorUrl);
      return;
    }
    setStatus('stopped');
    setMessage(desktopCompanionErrorMessage(response?.error, '저장된 캡처를 매뉴얼로 만들지 못했습니다.'));
  }, []);

  return (
    <main className="desktop-setup-page">
      <section className="desktop-setup-shell">
        <div className="desktop-setup-header">
          <div>
            <p className="desktop-setup-kicker">Parro Desktop Companion</p>
            <h1>데스크톱 녹화 준비</h1>
            <p className="desktop-setup-lead">Parro Desktop을 설치하면 바로 녹화를 시작할 수 있어요.</p>
          </div>
        </div>

        {!installerReady && (
          <div className="desktop-setup-warning">
            <strong>설치 파일이 아직 연결되지 않았습니다.</strong>
            <p>
              이 화면은 정식 <code>.exe</code> 다운로드 플로우를 받을 준비가 되어 있습니다.
              배포 환경에 <code>NEXT_PUBLIC_DESKTOP_INSTALLER_URL</code>을 연결하면 데스크톱 녹화 선택 시 자동 다운로드가 시작됩니다.
            </p>
          </div>
        )}

        {status === 'missing' || status === 'extension_missing' || status === 'idle' ? (
          <div className="desktop-setup-grid">
            <section className="desktop-setup-panel desktop-install-primary">
              <div className="desktop-setup-card-top">
                <p className="desktop-setup-section-label">설치</p>
                <span className="desktop-setup-status-pill" data-state={status}>{statusText}</span>
              </div>
              <h2>Parro Desktop 설치</h2>
              <p>원하는 방식으로 설치를 진행하세요.</p>
              <div className="desktop-setup-actions">
                <button type="button" onClick={() => handleInstallerDownload('auto')} disabled={!installerReady}>
                  설치 시작
                </button>
                <button type="button" className="desktop-secondary-install" onClick={() => handleInstallerDownload('download')} disabled={!installerReady}>
                  설치 파일 다운로드
                </button>
                <button type="button" onClick={() => { void checkInstall(false); }}>
                  설치 완료 후 다시 확인
                </button>
              </div>
              {message && <p className="desktop-setup-message">{message}</p>}
            </section>
          </div>
        ) : (
          <section className="desktop-setup-panel desktop-launcher-panel">
            <p className="desktop-setup-section-label">앱 실행</p>
            <h2>{status === 'launching' ? 'Parro Desktop 앱을 여는 중입니다.' : 'Parro Desktop 앱에서 계속하세요.'}</h2>
            <p>
              화면 선택, 사이드 패널, 숨김 모드, 녹화 종료는 이제 Windows 앱에서 진행합니다.
            </p>
            <div className="desktop-setup-actions desktop-launcher-actions">
              <button type="button" onClick={openDesktopApp} disabled={status === 'launching' || status === 'checking'}>
                Parro Desktop 앱 열기
              </button>
              <button type="button" onClick={() => { void checkInstall(true); }}>
                연결 다시 확인
              </button>
              {pendingSessionId && (
                <button
                  type="button"
                  onClick={() => importDesktopCapture(pendingSessionId)}
                  disabled={status === 'importing' || status === 'complete'}
                >
                  저장된 캡처로 매뉴얼 만들기
                </button>
              )}
            </div>
            {message && <p className="desktop-setup-message">{message}</p>}
          </section>
        )}

        <div className="desktop-setup-footer">
          <a href="/home">홈으로 돌아가기</a>
          <a href={STORE_URL} target="_blank" rel="noopener noreferrer">Recorder 확장 설치</a>
        </div>
      </section>

      <style jsx>{`
        .desktop-setup-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #111827;
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 64px 20px;
        }

        .desktop-setup-shell {
          width: min(640px, 100%);
          margin: 0 auto;
        }

        .desktop-setup-header {
          margin-bottom: 22px;
          text-align: center;
        }

        .desktop-setup-kicker,
        .desktop-setup-section-label {
          margin: 0;
          font-size: 11px;
          font-weight: 800;
          color: #4f46e5;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .desktop-setup-header h1 {
          margin: 12px 0 0;
          font-size: 36px;
          line-height: 1.15;
          letter-spacing: -0.04em;
        }

        .desktop-setup-lead {
          margin: 12px auto 0;
          max-width: 420px;
          color: #64748b;
          line-height: 1.55;
          font-size: 15px;
        }

        .desktop-setup-status-pill {
          min-height: 28px;
          padding: 0 10px;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          background: #f8fafc;
          display: flex;
          align-items: center;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .desktop-setup-status-pill[data-state='ready'],
        .desktop-setup-status-pill[data-state='started'] {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #047857;
        }

        .desktop-setup-status-pill[data-state='missing'],
        .desktop-setup-status-pill[data-state='extension_missing'] {
          border-color: #fed7aa;
          background: #fff7ed;
          color: #c2410c;
        }

        .desktop-setup-warning {
          border: 1px solid #fde68a;
          background: #fffbeb;
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 20px;
          color: #78350f;
        }

        .desktop-setup-warning strong {
          display: block;
          font-size: 14px;
          margin-bottom: 6px;
        }

        .desktop-setup-warning p,
        .desktop-setup-note,
        .desktop-setup-message,
        .desktop-setup-session {
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
        }

        .desktop-setup-grid {
          display: block;
        }

        .desktop-setup-panel {
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 18px;
          padding: 28px;
          box-shadow: 0 18px 48px rgba(15, 23, 42, .06);
        }

        .desktop-setup-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .desktop-install-primary h2,
        .desktop-launcher-panel h2 {
          margin: 0;
          font-size: 22px;
          letter-spacing: -0.03em;
        }

        .desktop-install-primary > p,
        .desktop-launcher-panel > p {
          margin: 8px 0 22px;
          color: #64748b;
          font-size: 14px;
          line-height: 1.55;
        }

        .desktop-setup-principle {
          margin-top: 16px;
        }

        .desktop-setup-principle-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .desktop-setup-principle-grid strong {
          display: block;
          font-size: 13.5px;
          margin-bottom: 6px;
        }

        .desktop-setup-principle-grid p {
          margin: 0;
          color: #6b7280;
          font-size: 12.5px;
          line-height: 1.6;
        }

        .desktop-setup-steps {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 16px;
        }

        .desktop-setup-steps li {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
        }

        .desktop-setup-steps li > span {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background: #eef2ff;
          color: #3730a3;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 800;
        }

        .desktop-setup-steps strong {
          display: block;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .desktop-setup-steps p {
          margin: 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.55;
        }

        .desktop-setup-actions {
          display: grid;
          gap: 9px;
          margin-bottom: 12px;
        }

        .desktop-display-picker {
          margin: 0 0 18px;
          padding: 14px;
          border: 1px solid #cfe7e2;
          border-radius: 12px;
          background: #f3fbf9;
        }

        .desktop-display-picker-heading {
          display: grid;
          gap: 4px;
          margin-bottom: 11px;
        }

        .desktop-display-picker-heading strong {
          font-size: 14px;
          color: #123b33;
        }

        .desktop-display-picker-heading span {
          color: #667b75;
          font-size: 11.5px;
          line-height: 1.5;
        }

        .desktop-display-options {
          display: grid;
          gap: 8px;
        }

        .desktop-display-option {
          min-height: 62px;
          padding: 9px 11px;
          border: 1.5px solid #dbe7e3;
          border-radius: 10px;
          background: white;
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          text-align: left;
          color: #233b36;
          cursor: pointer;
        }

        .desktop-display-option[data-selected='true'] {
          border-color: #008e86;
          background: #edfaf7;
          box-shadow: 0 0 0 3px rgba(0, 142, 134, .09);
        }

        .desktop-display-icon {
          width: 46px;
          height: 31px;
          border: 2px solid #78938d;
          border-radius: 5px;
          display: grid;
          place-items: center;
          position: relative;
          background: #edf5f3;
        }

        .desktop-display-icon::after {
          content: '';
          position: absolute;
          width: 15px;
          height: 4px;
          left: 13px;
          bottom: -7px;
          border-top: 2px solid #78938d;
        }

        .desktop-display-icon i {
          font-style: normal;
          color: #42635c;
          font-size: 10px;
          font-weight: 900;
        }

        .desktop-display-icon-all {
          border-color: #008e86;
          background: #dff6f1;
        }

        .desktop-display-option > span:nth-child(2) {
          display: grid;
          gap: 3px;
        }

        .desktop-display-option b {
          font-size: 13px;
        }

        .desktop-display-option small {
          color: #71837f;
          font-size: 10.5px;
        }

        .desktop-display-option em {
          color: #007c72;
          font-size: 10px;
          font-style: normal;
          font-weight: 800;
        }

        .desktop-setup-actions button {
          min-height: 50px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          background: white;
          color: #1e293b;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .desktop-setup-actions button:first-child:not(:disabled) {
          border-color: transparent;
          background: #3730a3;
          color: white;
        }

        .desktop-setup-actions .desktop-secondary-install {
          border-color: #c7d2fe;
          background: #f1f5ff;
          color: #312e81;
        }

        .desktop-setup-actions button:disabled {
          cursor: not-allowed;
          background: #f3f4f6;
          color: #9ca3af;
        }

        .desktop-setup-note,
        .desktop-setup-message,
        .desktop-setup-session {
          color: #4b5563;
        }

        .desktop-setup-message {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #fff7ed;
          color: #9a3412;
          font-size: 12.5px;
        }

        .desktop-setup-session {
          margin-top: 10px;
        }

        .desktop-setup-footer {
          display: flex;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 20px;
          font-size: 12.5px;
        }

        .desktop-setup-footer a,
        .desktop-setup-note a {
          color: #475569;
          font-weight: 700;
          text-decoration: none;
        }

        @media (max-width: 760px) {
          .desktop-setup-page {
            padding: 28px 16px;
          }

          .desktop-setup-header,
          .desktop-setup-grid,
          .desktop-setup-principle-grid {
            grid-template-columns: 1fr;
          }

          .desktop-setup-header h1 {
            font-size: 28px;
          }
        }
      `}</style>
    </main>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORE_URL = 'https://chromewebstore.google.com/detail/mimic-recorder/ehbhcdkapcbfehinjapabgoegcjmmbgd';
const INSTALLER_URL = process.env.NEXT_PUBLIC_DESKTOP_INSTALLER_URL?.replace(/^\uFEFF/, '').trim()
  || '/downloads/ParroDesktopSetup.exe';

type DesktopStatus = 'idle' | 'checking' | 'ready' | 'missing' | 'extension_missing' | 'starting' | 'started' | 'pausing' | 'paused' | 'stopping' | 'importing' | 'complete' | 'stopped';

interface DesktopCompanionResponse {
  ok?: boolean;
  sessionId?: string;
  desktop?: {
    host?: string;
    connected?: boolean;
    lastError?: string | null;
  };
  error?: string;
  tutorialId?: string;
  stepCount?: number;
  capturedSteps?: number;
  editorUrl?: string;
}

function getExtensionId(): string {
  return process.env.NEXT_PUBLIC_EXTENSION_ID?.replace(/^\uFEFF/, '').trim() || '';
}

function canTalkToExtension(): boolean {
  return typeof window !== 'undefined' && !!window.chrome?.runtime?.sendMessage && !!getExtensionId();
}

function sendExtensionMessage(action: string, payload: Record<string, unknown> = {}, timeoutMs = 5000): Promise<DesktopCompanionResponse | null> {
  return new Promise(resolve => {
    const extensionId = getExtensionId();
    if (!extensionId || !window.chrome?.runtime?.sendMessage) {
      resolve({ error: 'extension_api_unavailable' });
      return;
    }

    const timer = window.setTimeout(() => resolve({ error: 'extension_response_timeout' }), timeoutMs);
    try {
      window.chrome.runtime.sendMessage(extensionId, { action, ...payload }, response => {
        window.clearTimeout(timer);
        const runtimeError = window.chrome?.runtime?.lastError?.message;
        if (runtimeError) {
          resolve({ error: `extension_unreachable: ${runtimeError}` });
          return;
        }
        resolve((response as DesktopCompanionResponse | undefined) || { error: 'extension_empty_response' });
      });
    } catch (error) {
      window.clearTimeout(timer);
      resolve({ error: `extension_send_failed: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
}

function isExtensionConnectionError(error: string | undefined): boolean {
  return !!error && (
    error === 'extension_api_unavailable'
    || error === 'extension_response_timeout'
    || error === 'extension_empty_response'
    || error.startsWith('extension_unreachable:')
    || error.startsWith('extension_send_failed:')
  );
}

function triggerInstallerDownload() {
  if (!INSTALLER_URL) return;
  const link = document.createElement('a');
  link.href = INSTALLER_URL;
  link.download = 'ParroDesktopSetup.exe';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function desktopErrorMessage(error: string | undefined, fallback: string): string {
  switch (error) {
    case 'not_linked':
      return 'Parro에 로그인하고 Recorder를 계정에 연결한 뒤 다시 시도해주세요. 캡처 파일은 PC에 그대로 보관됩니다.';
    case 'desktop_capture_empty':
      return '저장된 캡처 단계가 없습니다. 캡처를 시작한 뒤 대상 앱을 한 번 이상 클릭해주세요.';
    case 'desktop_host_unavailable':
    case 'desktop_host_disconnected':
      return 'Desktop Companion에 연결하지 못했습니다. 앱 설치 상태를 확인한 뒤 다시 시도해주세요.';
    case 'desktop_host_timeout':
      return 'Desktop Companion 응답이 지연되고 있습니다. 캡처 파일은 보존되므로 잠시 후 다시 시도해주세요.';
    case 'nothing_to_undo':
      return '취소할 캡처 단계가 없습니다.';
    default:
      return error ? `${fallback} (${error})` : fallback;
  }
}

export default function DesktopSetupPage() {
  const importAttempted = useRef(false);
  const [status, setStatus] = useState<DesktopStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [autoImport, setAutoImport] = useState(false);

  const installerReady = INSTALLER_URL.length > 0;
  const statusText = useMemo(() => {
    switch (status) {
      case 'checking':
        return 'Desktop Companion 연결을 확인하고 있습니다.';
      case 'ready':
        return '설치가 확인되었습니다. 이제 데스크톱 녹화를 시작할 수 있습니다.';
      case 'missing':
        return 'Desktop Companion을 찾지 못했습니다. 설치를 완료한 뒤 다시 확인해주세요.';
      case 'extension_missing':
        return 'Parro Recorder 확장이 먼저 필요합니다.';
      case 'starting':
        return '데스크톱 녹화 세션을 시작하고 있습니다.';
      case 'started':
        return '데스크톱 녹화 세션이 켜졌습니다.';
      case 'pausing':
        return '데스크톱 녹화 상태를 변경하고 있습니다.';
      case 'paused':
        return '데스크톱 녹화가 일시정지되었습니다.';
      case 'stopping':
        return '데스크톱 녹화를 종료하고 캡처를 확인하고 있습니다.';
      case 'importing':
        return '캡처를 분석해 매뉴얼을 만들고 있습니다. 이 창을 닫지 마세요.';
      case 'complete':
        return '매뉴얼이 완성되었습니다. 편집기로 이동합니다.';
      case 'stopped':
        return '데스크톱 녹화가 종료되었습니다.';
      default:
        return '설치 파일을 내려받고 설치를 완료해주세요.';
    }
  }, [status]);

  const handleDownload = useCallback(() => {
    if (!installerReady) {
      setMessage('아직 정식 .exe 설치 파일 URL이 연결되지 않았습니다. NEXT_PUBLIC_DESKTOP_INSTALLER_URL 설정이 필요합니다.');
      return;
    }
    triggerInstallerDownload();
    setMessage('다운로드가 시작되었습니다. 설치 파일을 실행한 뒤 연결 확인을 눌러주세요.');
  }, [installerReady]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPendingSessionId(params.get('session'));
    setAutoImport(params.get('autoImport') === '1');
  }, []);

  const checkInstall = useCallback(async () => {
    if (!canTalkToExtension()) {
      setStatus('extension_missing');
      setMessage('Desktop Companion 상태 확인은 Parro Recorder 확장을 통해 진행됩니다. 확장을 먼저 설치하거나 연결해주세요.');
      return;
    }

    setStatus('checking');
    setMessage(null);
    const response = await sendExtensionMessage('DESKTOP_COMPANION_STATUS');

    if (response?.desktop?.connected) {
      setStatus('ready');
      setMessage(null);
      return;
    }

    if (isExtensionConnectionError(response?.error)) {
      setStatus('extension_missing');
      setMessage(`Parro Recorder 1.7.1에 연결하지 못했습니다. 확장 ID가 ${getExtensionId()}인지 확인하고 확장 카드의 새로고침을 눌러주세요. (${response?.error})`);
      return;
    }

    setStatus('missing');
    setMessage(response?.desktop?.lastError || '설치된 Desktop Companion에 연결하지 못했습니다.');
  }, []);

  const startDesktopRecording = useCallback(async () => {
    if (status !== 'ready') return;
    setStatus('starting');
    setMessage(null);
    const response = await sendExtensionMessage('START_DESKTOP_RECORDING');

    if (response?.ok) {
      setSessionId(response.sessionId || null);
      setStatus('started');
      return;
    }

    setStatus('missing');
    setMessage(response?.error || 'Desktop Companion 녹화 세션을 시작하지 못했습니다.');
  }, [status]);

  const stopDesktopRecording = useCallback(async () => {
    if (status !== 'started' && status !== 'paused') return;
    setStatus('stopping');
    setMessage('캡처 업로드와 AI 분석이 끝나면 편집기로 자동 이동합니다.');
    const response = await sendExtensionMessage('STOP_DESKTOP_RECORDING', { sessionId }, 180000);

    if (response?.ok && response.editorUrl) {
      setStatus('complete');
      setMessage(`${response.stepCount || 0}개 단계의 매뉴얼이 만들어졌습니다.`);
      window.location.assign(response.editorUrl);
      return;
    }

    setStatus('started');
    setMessage(desktopErrorMessage(response?.error, 'Desktop Companion 녹화를 종료하거나 매뉴얼로 만들지 못했습니다.'));
  }, [sessionId, status]);

  const toggleDesktopPause = useCallback(async () => {
    if (!sessionId || (status !== 'started' && status !== 'paused')) return;
    const resume = status === 'paused';
    setStatus('pausing');
    setMessage(null);
    const response = await sendExtensionMessage(resume ? 'RESUME_DESKTOP_RECORDING' : 'PAUSE_DESKTOP_RECORDING', { sessionId });
    if (response?.ok) {
      setStatus(resume ? 'started' : 'paused');
      return;
    }
    setStatus(resume ? 'paused' : 'started');
    setMessage(desktopErrorMessage(response?.error, resume ? '녹화를 다시 시작하지 못했습니다.' : '녹화를 일시정지하지 못했습니다.'));
  }, [sessionId, status]);

  const undoDesktopCapture = useCallback(async () => {
    if (!sessionId || (status !== 'started' && status !== 'paused')) return;
    setMessage('최근 캡처를 취소하고 있습니다.');
    const response = await sendExtensionMessage('UNDO_DESKTOP_CAPTURE', { sessionId });
    setMessage(response?.ok
      ? `최근 캡처를 취소했습니다. 현재 ${response.capturedSteps || 0}개 단계가 남았습니다.`
      : desktopErrorMessage(response?.error, '취소할 최근 캡처가 없습니다.'));
  }, [sessionId, status]);

  const importDesktopCapture = useCallback(async (captureSessionId: string) => {
    if (!captureSessionId) return;
    if (!canTalkToExtension()) {
      setStatus('extension_missing');
      setMessage('Parro Recorder 확장을 설치하고 계정에 연결한 뒤 다시 시도해주세요. 캡처 파일은 PC에 그대로 보관됩니다.');
      return;
    }
    setSessionId(captureSessionId);
    setStatus('importing');
    setMessage('저장된 데스크톱 캡처를 업로드하고 AI로 제목과 설명을 만드는 중입니다.');
    const response = await sendExtensionMessage('IMPORT_DESKTOP_CAPTURE', { sessionId: captureSessionId }, 180000);
    if (response?.ok && response.editorUrl) {
      setStatus('complete');
      setMessage(`${response.stepCount || 0}개 단계의 매뉴얼이 만들어졌습니다.`);
      window.location.assign(response.editorUrl);
      return;
    }
    setStatus('stopped');
    setMessage(desktopErrorMessage(response?.error, '저장된 캡처를 매뉴얼로 만들지 못했습니다.'));
  }, []);

  useEffect(() => {
    if (!autoImport || !pendingSessionId || importAttempted.current) return;
    importAttempted.current = true;
    void importDesktopCapture(pendingSessionId);
  }, [autoImport, importDesktopCapture, pendingSessionId]);

  return (
    <main className="desktop-setup-page">
      <section className="desktop-setup-shell">
        <div className="desktop-setup-header">
          <div>
            <p className="desktop-setup-kicker">Parro Desktop Companion</p>
            <h1>데스크톱 녹화 설치</h1>
            <p className="desktop-setup-lead">
              Windows 다운로드, 업로드, 설치, 로그인 작업까지 끊기지 않게 기록하려면 Desktop Companion 설치가 먼저 필요합니다.
            </p>
          </div>
          <div className="desktop-setup-status" data-state={status}>
            <span />
            {statusText}
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

        <div className="desktop-setup-grid">
          <section className="desktop-setup-panel">
            <p className="desktop-setup-section-label">설치 순서</p>
            <ol className="desktop-setup-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>설치 파일 다운로드</strong>
                  <p><strong>설치 파일 다운로드</strong> 버튼을 눌러 <code>ParroDesktopSetup.exe</code>를 받습니다.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>기본 옵션으로 설치</strong>
                  <p>설치를 완료하면 Recorder 확장이 Desktop Companion을 감지할 수 있습니다.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>연결 확인 후 녹화 시작</strong>
                  <p>설치 확인 후 녹화를 시작하고, 종료하면 캡처가 자동으로 매뉴얼과 편집기로 이어집니다.</p>
                </div>
              </li>
            </ol>
          </section>

          <section className="desktop-setup-panel">
            <p className="desktop-setup-section-label">실행</p>
            <div className="desktop-setup-actions">
              <button type="button" onClick={handleDownload} disabled={!installerReady}>
                설치 파일 다운로드
              </button>
              <button type="button" onClick={checkInstall}>
                설치 완료, 연결 확인
              </button>
              <button type="button" onClick={startDesktopRecording} disabled={status !== 'ready'}>
                데스크톱 녹화 시작
              </button>
              <button type="button" onClick={toggleDesktopPause} disabled={status !== 'started' && status !== 'paused'}>
                {status === 'paused' ? '녹화 계속' : '일시정지'}
              </button>
              <button type="button" onClick={undoDesktopCapture} disabled={status !== 'started' && status !== 'paused'}>
                최근 단계 취소
              </button>
              <button type="button" onClick={stopDesktopRecording} disabled={status !== 'started' && status !== 'paused'}>
                녹화 종료 후 매뉴얼 만들기
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
            {installerReady && (
              <p className="desktop-setup-note">
                자동 다운로드가 시작되지 않으면 <a href={INSTALLER_URL}>여기에서 다시 다운로드</a>할 수 있습니다.
              </p>
            )}
            {message && <p className="desktop-setup-message">{message}</p>}
            {sessionId && (
              <p className="desktop-setup-session">
                session: <code>{sessionId}</code>
              </p>
            )}
          </section>
        </div>

        <section className="desktop-setup-panel desktop-setup-principle">
          <p className="desktop-setup-section-label">동작 원리</p>
          <div className="desktop-setup-principle-grid">
            <div>
              <strong>1. 웹은 직접 Windows를 감지하지 않습니다.</strong>
              <p>Parro 웹 앱은 Recorder 확장에 설치 상태 확인을 요청합니다. 브라우저 보안상 웹페이지가 임의로 로컬 프로그램을 검사하지 않기 때문입니다.</p>
            </div>
            <div>
              <strong>2. Recorder 확장이 Desktop Companion을 확인합니다.</strong>
              <p>확장은 Chrome Native Messaging으로 설치된 Desktop Companion에 <code>PING</code>을 보내고, 정상 응답이 와야 설치 완료로 판단합니다.</p>
            </div>
            <div>
              <strong>3. 설치 확인 전에는 녹화를 켤 수 없습니다.</strong>
              <p>확인 전에는 <strong>데스크톱 녹화 시작</strong> 버튼이 잠겨 있습니다. 설치가 확인되면 확장이 Desktop Companion에 세션 시작 신호를 보내 녹화 흐름을 엽니다.</p>
            </div>
            <div>
              <strong>4. 종료하면 매뉴얼이 자동 생성됩니다.</strong>
              <p>캡처 이미지와 클릭 위치를 Recorder가 안전하게 읽어 AI 제목·설명을 만든 뒤 Parro 편집기로 이동합니다.</p>
            </div>
          </div>
        </section>

        <div className="desktop-setup-footer">
          <a href="/home">홈으로 돌아가기</a>
          <a href="/help#desktop-companion">Desktop Companion 안내 보기</a>
          <a href={STORE_URL} target="_blank" rel="noopener noreferrer">Recorder 확장 설치</a>
        </div>
      </section>

      <style jsx>{`
        .desktop-setup-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #111827;
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 48px 20px;
        }

        .desktop-setup-shell {
          width: min(960px, 100%);
          margin: 0 auto;
        }

        .desktop-setup-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 28px;
          align-items: end;
          margin-bottom: 20px;
        }

        .desktop-setup-kicker,
        .desktop-setup-section-label {
          margin: 0 0 10px;
          font-size: 12px;
          font-weight: 700;
          color: #4f46e5;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .desktop-setup-header h1 {
          margin: 0;
          font-size: 34px;
          line-height: 1.15;
          letter-spacing: 0;
        }

        .desktop-setup-lead {
          margin: 12px 0 0;
          max-width: 620px;
          color: #4b5563;
          line-height: 1.65;
          font-size: 15px;
        }

        .desktop-setup-status {
          min-height: 74px;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #374151;
          font-size: 13px;
          line-height: 1.5;
        }

        .desktop-setup-status span {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #9ca3af;
          flex: 0 0 auto;
        }

        .desktop-setup-status[data-state='ready'] span,
        .desktop-setup-status[data-state='started'] span {
          background: #059669;
        }

        .desktop-setup-status[data-state='missing'] span,
        .desktop-setup-status[data-state='extension_missing'] span {
          background: #d97706;
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
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
          gap: 16px;
        }

        .desktop-setup-panel {
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 8px;
          padding: 20px;
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
          gap: 10px;
          margin-bottom: 14px;
        }

        .desktop-setup-actions button {
          min-height: 44px;
          border-radius: 8px;
          border: 1.5px solid #e5e7eb;
          background: white;
          color: #374151;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .desktop-setup-actions button:first-child,
        .desktop-setup-actions button:last-child:not(:disabled) {
          border-color: transparent;
          background: #3730a3;
          color: white;
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
          margin-top: 10px;
          color: #92400e;
        }

        .desktop-setup-session {
          margin-top: 10px;
        }

        .desktop-setup-footer {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 18px;
          font-size: 13px;
        }

        .desktop-setup-footer a,
        .desktop-setup-note a {
          color: #3730a3;
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

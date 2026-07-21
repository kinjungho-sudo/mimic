'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BRAND_EXTENSION_STORE_URL } from '@/lib/brand';
import {
  canTalkToDesktopExtension,
  desktopCompanionErrorMessage,
  sendDesktopExtensionMessage,
} from '@/lib/desktop-companion-client';

type ImportState = 'preparing' | 'importing' | 'complete' | 'error';

export default function DesktopImportPage() {
  const attemptedSession = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [state, setState] = useState<ImportState>('preparing');
  const [message, setMessage] = useState('캡처 세션을 확인하고 있습니다.');

  const importCapture = useCallback(async (captureSessionId: string) => {
    if (!captureSessionId) {
      setState('error');
      setMessage('가져올 캡처 세션 정보가 없습니다. Parro Desktop에서 다시 완료를 눌러주세요.');
      return;
    }
    if (!canTalkToDesktopExtension()) {
      setState('error');
      setMessage('Parro Recorder 확장을 찾지 못했습니다. 확장을 설치하고 Parro 계정에 연결한 뒤 다시 시도해주세요. 캡처 파일은 PC에 그대로 보관됩니다.');
      return;
    }

    setState('importing');
    setMessage('캡처 이미지를 가져오고 AI가 단계 제목과 설명을 만드는 중입니다. 이 창을 닫지 마세요.');
    const response = await sendDesktopExtensionMessage(
      'IMPORT_DESKTOP_CAPTURE',
      { sessionId: captureSessionId },
      180000,
    );

    if (response?.ok && response.editorUrl) {
      setState('complete');
      setMessage(`${response.stepCount || 0}개 단계의 매뉴얼이 완성되었습니다. 편집기로 이동합니다.`);
      window.location.replace(response.editorUrl);
      return;
    }

    setState('error');
    setMessage(desktopCompanionErrorMessage(response?.error, '저장된 캡처를 매뉴얼로 만들지 못했습니다.'));
  }, []);

  useEffect(() => {
    const captureSessionId = new URLSearchParams(window.location.search).get('session') || '';
    setSessionId(captureSessionId);
    if (attemptedSession.current === captureSessionId) return;
    attemptedSession.current = captureSessionId;
    void importCapture(captureSessionId);
  }, [importCapture]);

  return (
    <main className="desktop-import-page">
      <section className="desktop-import-card" aria-live="polite">
        <div className="desktop-import-brand">
          <span className="desktop-import-mark">P</span>
          <span>Parro Desktop</span>
        </div>
        <div className="desktop-import-progress" data-state={state}>
          <span className="desktop-import-ring" />
          <div>
            <p className="desktop-import-kicker">CAPTURE IMPORT</p>
            <h1>{state === 'complete' ? '매뉴얼이 완성되었습니다' : state === 'error' ? '가져오기를 확인해주세요' : '캡처를 매뉴얼로 만들고 있습니다'}</h1>
            <p className="desktop-import-message">{message}</p>
          </div>
        </div>
        <div className="desktop-import-steps">
          <span className={state !== 'preparing' ? 'done' : 'active'}>1. 세션 확인</span>
          <span className={state === 'importing' ? 'active' : state === 'complete' ? 'done' : ''}>2. 이미지·동작 가져오기</span>
          <span className={state === 'complete' ? 'done' : ''}>3. 편집기 열기</span>
        </div>
        {sessionId && <p className="desktop-import-session">세션 <code>{sessionId}</code></p>}
        {state === 'error' && (
          <div className="desktop-import-actions">
            <button type="button" onClick={() => void importCapture(sessionId)}>다시 시도</button>
            <a href={BRAND_EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer">Recorder 설치</a>
            <Link href="/home">홈으로 이동</Link>
          </div>
        )}
      </section>
      <style jsx>{`
        .desktop-import-page { min-height:100vh; display:grid; place-items:center; padding:24px; background:#071411; color:#10231f; font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
        .desktop-import-card { width:min(640px,100%); padding:34px; border:1px solid rgba(255,255,255,.14); border-radius:24px; background:#f8fffd; box-shadow:0 30px 90px rgba(0,0,0,.35); }
        .desktop-import-brand { display:flex; align-items:center; gap:10px; margin-bottom:36px; color:#0b2c26; font-size:15px; font-weight:800; }
        .desktop-import-mark { width:34px; height:34px; display:grid; place-items:center; border-radius:11px; background:#009b8e; color:white; font-weight:900; }
        .desktop-import-progress { display:grid; grid-template-columns:64px minmax(0,1fr); gap:20px; align-items:start; }
        .desktop-import-ring { width:58px; height:58px; border:5px solid #d9eee9; border-top-color:#009b8e; border-radius:50%; animation:spin .9s linear infinite; }
        .desktop-import-progress[data-state='complete'] .desktop-import-ring { border-color:#8dd63f; animation:none; }
        .desktop-import-progress[data-state='error'] .desktop-import-ring { border-color:#ef4444; border-width:4px; animation:none; }
        .desktop-import-kicker { margin:0 0 8px; color:#008e86; font-size:11px; font-weight:900; letter-spacing:.14em; }
        h1 { margin:0; font-size:28px; line-height:1.25; letter-spacing:-.035em; }
        .desktop-import-message { margin:12px 0 0; color:#5d706b; font-size:14px; line-height:1.7; word-break:keep-all; }
        .desktop-import-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:34px; }
        .desktop-import-steps span { padding:12px; border-radius:10px; background:#eef4f2; color:#81918d; font-size:11px; text-align:center; }
        .desktop-import-steps .active { background:#e2f7f2; color:#007c72; font-weight:800; }
        .desktop-import-steps .done { background:#edf8df; color:#557b18; font-weight:800; }
        .desktop-import-session { margin:18px 0 0; color:#7a8a86; font-size:11px; overflow-wrap:anywhere; }
        .desktop-import-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:24px; }
        .desktop-import-actions button,.desktop-import-actions a { min-height:40px; display:inline-flex; align-items:center; justify-content:center; padding:0 15px; border:1px solid #cfe1dc; border-radius:9px; background:white; color:#31534c; font:inherit; font-size:13px; font-weight:750; text-decoration:none; cursor:pointer; }
        .desktop-import-actions button { border-color:#009b8e; background:#009b8e; color:white; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @media (max-width:560px) { .desktop-import-card{padding:26px 20px}.desktop-import-progress{grid-template-columns:1fr}.desktop-import-steps{grid-template-columns:1fr}h1{font-size:24px} }
      `}</style>
    </main>
  );
}

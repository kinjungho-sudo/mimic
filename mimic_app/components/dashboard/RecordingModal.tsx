'use client';

import { useState, useCallback, useEffect } from 'react';

// 운영(Production)에서만 켜는 플래그 — Vercel Production env에 NEXT_PUBLIC_REQUIRE_EXTENSION=1.
// 로컬(npm run dev)·Preview(dev)는 값이 없어 게이트가 꺼진다(개발자 버전 미설치로도 작업 가능).
const REQUIRE_EXTENSION = process.env.NEXT_PUBLIC_REQUIRE_EXTENSION?.replace(/^﻿/, '').trim() === '1';

// ── 타입 ──────────────────────────────────────────────────

interface ChromeTab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  urlAccess?: boolean;
}

interface ExtensionLinkResponse {
  ok?: boolean;
  error?: string;
}

interface TabsResponse {
  ok?: boolean;
  tabs?: ChromeTab[];
  error?: string;
  diagnostics?: {
    total?: number;
    returned?: number;
    missingUrl?: number;
  };
}

interface StartRecordingResponse {
  ok?: boolean;
  reason?: 'not_linked' | 'missing_tab' | 'tab_not_found' | 'unsupported_url' | 'content_script_failed' | 'content_script_unreachable' | 'error';
  message?: string;
}

type ModalStep = 'checking' | 'guide' | 'tab_select' | 'launching' | 'not_installed' | 'start_failed' | 'install';

// ── 확장 통신 ─────────────────────────────────────────────

function isExtensionInstalled(): boolean {
  return !!(typeof window !== 'undefined' && window.chrome?.runtime?.sendMessage);
}

function sendMessage(action: string, payload?: Record<string, unknown>): Promise<unknown> {
  return new Promise(resolve => {
    const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID?.replace(/^﻿/, '').trim();
    if (!extensionId || !isExtensionInstalled()) {
      console.warn('[포리] 확장 없음 또는 extensionId 미설정, 바이패스');
      resolve(null);
      return;
    }
    // 5초 타임아웃 — 확장이 응답 안 하면 null 반환
    const timer = setTimeout(() => {
      console.warn('[포리] sendMessage 타임아웃:', action);
      resolve(null);
    }, 5000);
    window.chrome!.runtime!.sendMessage(extensionId, { action, ...payload }, resp => {
      clearTimeout(timer);
      if (window.chrome?.runtime?.lastError) {
        console.warn('[포리] lastError:', window.chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      console.log('[포리] 응답:', action, resp);
      resolve(resp);
    });
  });
}

// Service Worker가 잠든 상태일 때 첫 메시지가 실패하는 경쟁 조건 방지.
// CONNECT ping으로 먼저 깨운 뒤 실제 메시지를 전송한다.
// 최대 3회 재시도, 회당 600ms 대기.
async function wakeAndSend(action: string, payload?: Record<string, unknown>, retries = 3): Promise<unknown> {
  const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID?.replace(/^﻿/, '').trim();
  if (!extensionId || !isExtensionInstalled()) return null;

  for (let i = 0; i < retries; i++) {
    // ping
    const ping = await sendMessage('CONNECT');
    if (ping) {
      // Service Worker 깨어남 — 실제 메시지 전송
      return sendMessage(action, payload);
    }
    // 아직 안 깨어남 — 잠시 대기 후 재시도
    await new Promise(r => setTimeout(r, 600));
  }
  // 모든 재시도 실패
  console.warn('[포리] Service Worker 웨이크업 실패:', action);
  return null;
}

async function fetchOpenTabs(): Promise<TabsResponse | null> {
  const resp = await wakeAndSend('GET_TABS') as TabsResponse | null;
  if (!resp || !Array.isArray(resp.tabs)) {
    console.warn('[포리] GET_TABS 실패 또는 빈 응답:', resp);
    return null;
  }
  if (resp.tabs.length === 0 || resp.diagnostics?.missingUrl) {
    console.warn('[포리] GET_TABS 진단:', resp);
  }
  return resp;
}

async function linkExtensionToCurrentUser(): Promise<boolean> {
  const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID?.replace(/^﻿/, '').trim();
  if (!extensionId || !isExtensionInstalled()) return !REQUIRE_EXTENSION;

  try {
    const res = await fetch('/api/extension/link', { method: 'POST' });
    if (!res.ok) {
      console.warn('[포리] extension link token 발급 실패:', res.status);
      return false;
    }

    const data = await res.json() as { token?: string };
    if (!data.token) return false;

    const resp = await wakeAndSend('LINK_USER', { token: data.token }) as ExtensionLinkResponse | null;
    if (!resp?.ok) {
      console.warn('[포리] extension LINK_USER 실패:', resp?.error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[포리] extension 재연동 실패:', err);
    return false;
  }
}

async function sendStartRecording(tabId: number, url: string): Promise<StartRecordingResponse> {
  if (!isExtensionInstalled()) return { ok: true }; // 바이패스
  // 1차: user gesture를 유지한 채 CONNECT 없이 즉시 전송한다.
  //      이래야 확장이 chrome.sidePanel.open()을 제스처 컨텍스트에서 호출해
  //      사이드 패널을 자동으로 열 수 있다 (#2). 탭 선택 직전 GET_TABS로 SW는 이미 깨어있음.
  let resp = await sendMessage('START_RECORDING', { tabId, url }) as StartRecordingResponse | null;
  if (resp && resp.ok) return resp;
  // 2차: SW가 잠들어 1차가 실패하면 wake 후 재시도 (제스처 소실 → 패널은 수동 클릭 필요할 수 있음)
  resp = await wakeAndSend('START_RECORDING', { tabId, url }) as StartRecordingResponse | null;
  return resp ?? { ok: false, reason: 'error', message: '포리 Recorder가 응답하지 않았습니다.' };
}

// ── 안내 단계 데이터 ──────────────────────────────────────

const GUIDE_STEPS = [
  { text: '녹화할 웹 페이지를 선택하세요.', extra: null },
  {
    text: '우측 상단의 포리 Recorder에서 녹화 버튼을 눌러주세요.',
    extra: 'recorder_button',
  },
  { text: '작업을 수행하면 단계별로 자동 캡처됩니다.', extra: null },
  { text: '녹화 종료 후 대시보드에서 매뉴얼을 확인하세요.', extra: null },
];

function startFailureMessage(failure: StartRecordingResponse | null): string {
  if (failure?.message) return failure.message;
  switch (failure?.reason) {
    case 'unsupported_url':
      return 'Chrome 내부 페이지나 확장 프로그램 페이지는 녹화할 수 없습니다. 일반 웹사이트 탭을 선택해주세요.';
    case 'content_script_failed':
    case 'content_script_unreachable':
      return '선택한 페이지에 녹화 스크립트를 연결하지 못했습니다. 페이지를 새로고침하거나 다른 웹사이트 탭을 선택해주세요.';
    case 'not_linked':
      return '포리 Recorder가 계정과 연동되지 않았습니다. 확장 프로그램을 다시 열고 연동을 완료해주세요.';
    case 'missing_tab':
    case 'tab_not_found':
      return '선택한 탭을 찾지 못했습니다. 탭 목록을 다시 불러와주세요.';
    default:
      return '포리 Recorder가 녹화를 시작하지 못했습니다. 탭 권한과 사이트 권한을 확인해주세요.';
  }
}

// ── 파비콘 fallback ───────────────────────────────────────

function FavIcon({ url, favIconUrl }: { url: string; favIconUrl?: string }) {
  const [errored, setErrored] = useState(false);
  const domain = (() => { try { return new URL(url).hostname; } catch { return ''; } })();

  if (favIconUrl && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={favIconUrl}
        alt=""
        width={16} height={16}
        style={{ borderRadius: '3px', flexShrink: 0 }}
        onError={() => setErrored(true)}
      />
    );
  }

  // 글자 fallback
  const letter = domain.replace('www.', '').charAt(0).toUpperCase() || '?';
  const colors = ['#3730a3','#6d28d9','#DB2777','#D97706','#059669','#0284C7'];
  const bg = colors[letter.charCodeAt(0) % colors.length];
  return (
    <span style={{ width: '16px', height: '16px', borderRadius: '3px', background: bg, color: 'white', display: 'grid', placeItems: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>
      {letter}
    </span>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

interface RecordingModalProps {
  onClose: () => void;
}

const STORE_URL = 'https://chromewebstore.google.com/detail/mimic-recorder/ehbhcdkapcbfehinjapabgoegcjmmbgd';

export function RecordingModal({ onClose }: RecordingModalProps) {
  const [step, setStep] = useState<ModalStep>('checking');
  const [tabs, setTabs] = useState<ChromeTab[]>([]);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<ChromeTab | null>(null);
  const [search, setSearch] = useState('');
  const [tabListIssue, setTabListIssue] = useState<string | null>(null);
  const [startFailure, setStartFailure] = useState<StartRecordingResponse | null>(null);

  // ESC 닫기
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // 모달 진입 시:
  // - dev/Preview(REQUIRE_EXTENSION 꺼짐): 확장 강제 없이 바로 가이드 (기존 동작)
  // - 운영(REQUIRE_EXTENSION 켜짐): CONNECT ping으로 설치 여부 확인 → 미설치/미응답이면
  //   크롬 웹스토어 설치 페이지로 직접 보낸다.
  useEffect(() => {
    if (!REQUIRE_EXTENSION) { setStep('guide'); return; }
    let alive = true;
    setStep('checking');
    (async () => {
      const resp = await wakeAndSend('CONNECT'); // SW 깨우고 설치 여부 확인
      if (!alive) return;
      if (resp) setStep('guide');
      else window.location.href = STORE_URL; // 미설치 → 크롬 웹스토어 설치 페이지로 직접
    })();
    return () => { alive = false; };
  }, []);

  // 탭 선택 단계 진입 시 목록 로드
  const enterTabSelect = useCallback(async () => {
    setStep('tab_select');
    setTabsLoading(true);
    setSelectedTab(null);
    setTabs([]);
    setTabListIssue(null);
    setStartFailure(null);

    const linked = await linkExtensionToCurrentUser();
    if (!linked) {
      setTabsLoading(false);
      setStep('not_installed');
      return;
    }

    const fetched = await fetchOpenTabs();
    const fetchedTabs = fetched?.tabs ?? [];

    if (fetchedTabs.length > 0) {
      setTabs(fetchedTabs);
      setSelectedTab(fetchedTabs[0]);
      if (fetched?.diagnostics?.missingUrl) {
        setTabListIssue('일부 탭의 URL 권한이 제한되어 미리보기 없이 녹화를 시작합니다.');
      }
    } else {
      setTabs([]);
      setSelectedTab(null);
      setTabListIssue(
        fetched?.error
          ? `탭 목록을 가져오지 못했어요: ${fetched.error}`
          : '열린 탭을 찾지 못했어요. 포리 Recorder 확장의 탭 권한과 사이트 권한을 확인해주세요.'
      );
    }
    setTabsLoading(false);
  }, []);

  const handleStart = useCallback(async () => {
    if (!selectedTab) return;
    setStep('launching');
    setStartFailure(null);
    const result = await sendStartRecording(selectedTab.id, selectedTab.url);
    if (!result.ok) {
      setStartFailure(result);
      setStep('start_failed');
      return;
    }
    onClose();
  }, [selectedTab, onClose]);

  const filteredTabs = tabs.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.url || '').toLowerCase().includes(search.toLowerCase())
  );

  // 탭 선택 단계: 모달 넓게
  const isWide = step === 'tab_select';


  return (
    <>
      {/* 딤 배경 */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.50)', zIndex: 1000, backdropFilter: 'blur(3px)' }}
      />

      {/* 모달 */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1001,
          width: isWide ? '820px' : '480px',
          maxWidth: 'calc(100vw - 32px)',
          background: 'white', borderRadius: '20px',
          boxShadow: '0 32px 80px rgba(10,10,15,0.26), 0 0 0 1px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          animation: 'modalIn 0.22s cubic-bezier(0.34,1.4,0.64,1)',
          fontFamily: "'Pretendard', -apple-system, sans-serif",
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* 헤더 */}
        <div style={{ background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', padding: '22px 28px 18px', position: 'relative' }}>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ position: 'absolute', top: '14px', right: '16px', width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#FCA5A5', animation: 'recPulse 1.4s ease-in-out infinite' }} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>포리 Recorder</span>
          </div>
          <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
            {step === 'checking' && '확장 프로그램 확인 중…'}
            {step === 'guide' && '새 매뉴얼 녹화 시작'}
            {step === 'tab_select' && '녹화할 페이지 선택'}
            {step === 'launching' && 'Recorder 실행 중…'}
            {step === 'not_installed' && '확장 프로그램이 필요해요'}
            {step === 'start_failed' && '녹화를 시작하지 못했어요'}
            {step === 'install' && '포리 Recorder 설치 필요'}
          </h2>
          <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.72)', marginTop: '3px' }}>
            {step === 'checking' && '잠시만 기다려주세요'}
            {step === 'guide' && '화면 녹화로 매뉴얼을 자동으로 만들어드릴게요'}
            {step === 'tab_select' && (tabListIssue || `열린 탭 ${tabs.length}개 · 페이지를 선택하면 오른쪽에 미리보기가 표시됩니다`)}
            {step === 'launching' && '잠시만 기다려주세요'}
            {step === 'not_installed' && '포리 Recorder를 먼저 설치해야 녹화할 수 있어요'}
            {step === 'start_failed' && '선택한 탭 또는 권한 상태를 확인해주세요'}
            {step === 'install' && '설치 후 연동하면 바로 녹화할 수 있어요'}
          </p>
        </div>

        {/* ── 확인 중 ── */}
        {step === 'checking' && (
          <div style={{ padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', border: '3px solid rgba(55,48,163,0.15)', borderTopColor: '#3730a3', animation: 'spin 0.9s linear infinite', margin: '0 auto' }} />
          </div>
        )}

        {/* ── 가이드 단계 ── */}
        {step === 'guide' && (
          <div style={{ padding: '24px 28px 28px' }}>
            <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>진행 방법</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
              {GUIDE_STEPS.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e0e7ff', color: '#3730a3', fontSize: '11px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: '1px' }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13.5px', color: '#374151', lineHeight: 1.55 }}>{s.text}</span>
                    {s.extra === 'recorder_button' && (
                      <div style={{ marginTop: '9px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', borderRadius: '8px', boxShadow: '0 2px 6px rgba(239,68,68,0.28)' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'white', animation: 'recPulse 1.4s ease-in-out infinite' }} />
                        <span style={{ fontSize: '11.5px', color: 'white', fontWeight: 600 }}>녹화 시작</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '11px 14px', marginBottom: '22px', display: 'flex', gap: '10px' }}>
              <span style={{ fontSize: '15px', flexShrink: 0 }}>💡</span>
              <p style={{ fontSize: '12.5px', color: '#78350F', lineHeight: 1.55, margin: 0 }}>
                녹화 중에는 <strong>클릭한 위치</strong>와 <strong>화면 변화</strong>가 자동으로 캡처됩니다.
              </p>
            </div>
            <button
              onClick={enterTabSelect}
              style={{ width: '100%', padding: '13px', borderRadius: '11px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontSize: '14.5px', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(55,48,163,0.30)' }}
            >
              페이지 선택하기 →
            </button>
          </div>
        )}


        {/* ── 탭 선택 단계 ── */}
        {step === 'tab_select' && (
          <div style={{ display: 'flex', height: '460px' }}>

            {/* 좌측: 탭 목록 */}
            <div style={{ width: '320px', borderRight: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              {/* 검색 */}
              <div style={{ padding: '14px 16px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '9px', background: '#F9FAFB' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="탭 검색..."
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: '#374151', fontFamily: 'inherit' }}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'grid', placeItems: 'center', padding: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* 목록 */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
                {tabsLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ height: '48px', borderRadius: '8px', background: 'linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                    ))}
                  </div>
                ) : filteredTabs.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px', lineHeight: 1.6 }}>
                    {tabs.length === 0
                      ? <>{tabListIssue ?? '확장과 연결할 수 없어요.'}<br/>확장 관리에서 포리 Recorder 권한을 확인해주세요.</>
                      : '검색 결과가 없어요'}
                  </div>
                ) : (
                  filteredTabs.map(tab => {
                    const isSelected = selectedTab?.id === tab.id;
                    const domain = (() => { try { return new URL(tab.url).hostname.replace('www.', ''); } catch { return tab.url || 'URL 권한 필요'; } })();
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedTab(tab)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          width: '100%', padding: '10px 10px', borderRadius: '9px',
                          border: 'none', textAlign: 'left', cursor: 'pointer',
                          background: isSelected ? '#e0e7ff' : 'transparent',
                          transition: 'background 0.12s',
                          marginBottom: '2px',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F9FAFB'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <FavIcon url={tab.url} favIconUrl={tab.favIconUrl} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400, color: isSelected ? '#3730a3' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tab.title || domain}
                          </div>
                          <div style={{ fontSize: '11px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                            {domain}
                          </div>
                        </div>
                        {isSelected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* 하단 버튼 */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setStep('guide')}
                  style={{ flex: 1, padding: '10px', borderRadius: '9px', background: 'white', color: '#4B5563', fontSize: '13px', fontWeight: 500, border: '1.5px solid #E5E7EB', cursor: 'pointer' }}
                >
                  ← 이전
                </button>
                <button
                  onClick={handleStart}
                  disabled={!selectedTab}
                  style={{ flex: 2, padding: '10px', borderRadius: '9px', background: selectedTab ? 'linear-gradient(135deg, #3730a3, #6d28d9)' : '#E5E7EB', color: selectedTab ? 'white' : '#9CA3AF', fontSize: '13.5px', fontWeight: 600, border: 'none', cursor: selectedTab ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', boxShadow: selectedTab ? '0 3px 10px rgba(55,48,163,0.25)' : 'none', transition: 'all 0.15s' }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: selectedTab ? 'rgba(255,255,255,0.8)' : '#9CA3AF', animation: selectedTab ? 'recPulse 1.4s infinite' : 'none' }} />
                  녹화 시작
                </button>
              </div>
            </div>

            {/* 우측: 미리보기 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F9FA' }}>
              {selectedTab ? (
                <>
                  {/* URL 바 */}
                  <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #F3F4F6', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#F3F4F6', borderRadius: '8px' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span style={{ fontSize: '12px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {selectedTab.url || '탭 URL 권한 제한됨'}
                      </span>
                    </div>
                  </div>

                  {/* iframe 미리보기 */}
                  <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    {selectedTab.url ? (
                      <>
                        <iframe
                          src={selectedTab.url}
                          title="미리보기"
                          sandbox="allow-scripts allow-same-origin"
                          style={{ width: '160%', height: '160%', border: 'none', transform: 'scale(0.625)', transformOrigin: '0 0', pointerEvents: 'none' }}
                          onError={() => {}}
                        />
                        {/* X-Frame-Options 차단 시 fallback 오버레이 */}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,249,250,0)', pointerEvents: 'none' }}>
                        </div>
                      </>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#6B7280', padding: '24px', textAlign: 'center' }}>
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>
                        <p style={{ fontSize: '13px', lineHeight: 1.55, margin: 0 }}>
                          탭 URL 권한이 제한되어 미리보기를 표시할 수 없습니다.<br/>녹화가 실패하면 확장 권한을 확인해주세요.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 선택된 탭 정보 */}
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', background: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FavIcon url={selectedTab.url} favIconUrl={selectedTab.favIconUrl} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedTab.title}</div>
                    </div>
                    <span style={{ fontSize: '11px', padding: '3px 8px', background: '#e0e7ff', color: '#3730a3', borderRadius: '5px', fontWeight: 500, whiteSpace: 'nowrap' }}>선택됨</span>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', gap: '12px' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  <p style={{ fontSize: '13px', textAlign: 'center' }}>왼쪽에서 탭을 선택하면<br/>미리보기가 표시됩니다</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 실행 중 ── */}
        {step === 'launching' && (
          <div style={{ padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', border: '3px solid rgba(55,48,163,0.15)', borderTopColor: '#3730a3', animation: 'spin 0.9s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>포리 Recorder 실행 중…</p>
            <p style={{ fontSize: '13px', color: '#6B7280' }}>선택한 페이지에서 녹화가 곧 시작됩니다</p>
          </div>
        )}

        {/* ── 미설치 (녹화 시도 후 실패) ── */}
        {step === 'not_installed' && (
          <div style={{ padding: '24px 28px 28px' }}>
            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '12px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p style={{ fontSize: '13px', color: '#78350F', lineHeight: 1.55, margin: 0 }}>
                포리 Recorder 확장 프로그램이 설치되지 않았거나 비활성화되어 있어요.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href={STORE_URL} target="_blank" rel="noopener noreferrer"
                style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', boxShadow: '0 4px 14px rgba(55,48,163,0.30)', boxSizing: 'border-box' }}>
                포리 Recorder 설치하기
              </a>
              <button onClick={enterTabSelect} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'white', color: '#4B5563', fontSize: '14px', fontWeight: 500, border: '1.5px solid #E5E7EB', cursor: 'pointer' }}>
                설치 완료 — 다시 시도
              </button>
              <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'none', color: '#9CA3AF', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
                나중에
              </button>
            </div>
          </div>
        )}

        {/* ── 녹화 시작 실패 ── */}
        {step === 'start_failed' && (
          <div style={{ padding: '24px 28px 28px' }}>
            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '12px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p style={{ fontSize: '13px', color: '#78350F', lineHeight: 1.55, margin: 0 }}>
                {startFailureMessage(startFailure)}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={enterTabSelect} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(55,48,163,0.30)' }}>
                탭 다시 선택하기
              </button>
              <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'none', color: '#9CA3AF', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
                닫기
              </button>
            </div>
          </div>
        )}

        {/* ── 설치 유도 (최초 진입 시 미설치) ── */}
        {step === 'install' && (
          <div style={{ padding: '24px 28px 28px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '72px', height: '72px', margin: '0 auto 16px', borderRadius: '20px', background: 'linear-gradient(135deg, #e0e7ff, #F5F3FF)', display: 'grid', placeItems: 'center' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>
              </div>
              <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.6, margin: '0 auto', maxWidth: '340px' }}>
                화면 녹화로 매뉴얼을 만들려면<br/><strong style={{ color: '#111827' }}>포리 Recorder</strong> 확장 프로그램이 필요해요.
              </p>
            </div>
            <div style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px' }}>
              {[
                'Chrome 웹스토어에서 설치',
                '설치 후 이 창으로 돌아오기',
                '\'연동 완료\' 버튼 클릭 후 바로 녹화',
              ].map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: i < 2 ? '10px' : 0 }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#e0e7ff', color: '#3730a3', fontSize: '11px', fontWeight: 600, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: '13px', color: '#374151' }}>{text}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href={STORE_URL} target="_blank" rel="noopener noreferrer"
                style={{ width: '100%', padding: '13px', borderRadius: '11px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontSize: '14.5px', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', boxShadow: '0 4px 14px rgba(55,48,163,0.30)', boxSizing: 'border-box' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                포리 Recorder 설치하기
              </a>
              <button
                onClick={() => {
                  if (isExtensionInstalled()) {
                    sendMessage('CONNECT').then(resp => {
                      if (resp) setStep('guide');
                      else setStep('install');
                    });
                  } else {
                    setStep('install');
                  }
                }}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'white', color: '#4B5563', fontSize: '14px', fontWeight: 500, border: '1.5px solid #E5E7EB', cursor: 'pointer' }}
              >
                설치 완료 — 연동하기
              </button>
              <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'none', color: '#9CA3AF', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
                나중에
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn { 0%{opacity:0;transform:translate(-50%,-52%) scale(0.95)} 100%{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes recPulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.25)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
    </>
  );
}

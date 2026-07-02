'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, ExternalLink, Loader2, MousePointerClick, RotateCcw, Save, Zap } from 'lucide-react';
import { useTutorial } from '@/hooks/useTutorial';
import { updateStep } from '@/lib/api/steps';
import { startLiveGuide } from '@/lib/api/liveGuide';
import { logError } from '@/lib/logging/logger';
import type { Step, Tutorial } from '@/types';

const ICON = 14;

type RectDraft = { x: string; y: string; width: string; height: string };

type LiveStep = {
  id: string;
  number: number;
  title: string;
  instruction: string;
  pageUrl: string;
  selector: string;
  xpath: string;
  rect: RectDraft;
  clickX: string;
  clickY: string;
};

function pctToUnit(value: number | null | undefined): string {
  if (value == null) return '';
  const unit = value > 1 ? value / 100 : value;
  return Number.isFinite(unit) ? String(Math.round(unit * 10000) / 10000) : '';
}

function toLiveStep(step: Step): LiveStep {
  const rect = step.element_rect;
  return {
    id: step.id,
    number: step.step_number,
    title: step.user_title || step.ai_title || `Step ${step.step_number}`,
    instruction: (step.user_script || step.ai_description || '').replace(/<[^>]+>/g, ''),
    pageUrl: step.page_url ?? '',
    selector: step.element_selector ?? '',
    xpath: step.element_xpath ?? '',
    rect: {
      x: pctToUnit(rect?.x),
      y: pctToUnit(rect?.y),
      width: pctToUnit(rect?.width),
      height: pctToUnit(rect?.height),
    },
    clickX: pctToUnit(step.click_x),
    clickY: pctToUnit(step.click_y),
  };
}

function parseUnit(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return Math.min(1, n / 100);
  return n;
}

function toPatch(step: LiveStep) {
  const rectValues = {
    x: parseUnit(step.rect.x),
    y: parseUnit(step.rect.y),
    width: parseUnit(step.rect.width),
    height: parseUnit(step.rect.height),
  };
  const hasRect = Object.values(rectValues).every(v => v != null);

  return {
    page_url: step.pageUrl.trim() || null,
    element_selector: step.selector.trim() || null,
    element_xpath: step.xpath.trim() || null,
    element_rect: hasRect
      ? { x: rectValues.x!, y: rectValues.y!, width: rectValues.width!, height: rectValues.height! }
      : null,
    click_x: parseUnit(step.clickX),
    click_y: parseUnit(step.clickY),
  };
}

function health(step: LiveStep): { label: string; color: string; detail: string } {
  if (!step.pageUrl.trim()) return { label: 'URL 필요', color: '#fbbf24', detail: '실제 페이지로 이동할 기준 URL이 없습니다.' };
  if (step.selector.trim()) return { label: 'Selector 우선', color: '#34d399', detail: '라이브 가이드 Beta가 selector로 먼저 대상을 찾습니다.' };
  if (step.xpath.trim()) return { label: 'XPath 대기', color: '#60a5fa', detail: 'selector가 없으면 XPath로 대상을 찾습니다.' };
  if (Object.values(step.rect).every(Boolean)) return { label: 'Rect fallback', color: '#c084fc', detail: 'DOM 매칭 실패 시 저장된 위치 영역을 사용합니다.' };
  if (step.clickX.trim() && step.clickY.trim()) return { label: 'Click fallback', color: '#fb7185', detail: '마지막으로 클릭 좌표를 기준으로 안내합니다.' };
  return { label: '대상 없음', color: '#f87171', detail: '대상을 찾을 기준이 없어 잘못된 위치에 표시될 수 있습니다.' };
}

export default function LiveStudioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tutorial, loading, error, publish } = useTutorial(id);
  const [steps, setSteps] = useState<LiveStep[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [liveStarting, setLiveStarting] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isViewer = tutorial ? (tutorial as Tutorial & { my_role?: string }).my_role === 'viewer' : false;

  useEffect(() => {
    if (!tutorial) return;
    const next = tutorial.steps.map(toLiveStep);
    setSteps(next);
    setActiveId(prev => prev ?? next[0]?.id ?? null);
  }, [tutorial]);

  const active = steps.find(step => step.id === activeId) ?? null;
  const targetUrlCount = useMemo(() => steps.filter(step => step.pageUrl.trim()).length, [steps]);
  const unresolvedCount = useMemo(() => steps.filter(step => health(step).label === '대상 없음').length, [steps]);

  const ensurePublished = useCallback(async () => {
    const existing = (tutorial as Tutorial & { share_token?: string | null } | null)?.share_token;
    if (existing) return existing;
    setPublishing(true);
    try {
      const result = await publish();
      return result.share_token;
    } finally {
      setPublishing(false);
    }
  }, [publish, tutorial]);

  const saveStep = useCallback(async (step: LiveStep) => {
    setSavingId(step.id);
    try {
      await updateStep(step.id, toPatch(step));
      setSavedTick(t => t + 1);
    } catch (err) {
      logError('live-studio.save.fail', { stepId: step.id, message: err instanceof Error ? err.message : String(err) });
      alert('라이브 가이드 Beta 대상 저장에 실패했습니다. 입력값을 확인해주세요.');
    } finally {
      setSavingId(current => (current === step.id ? null : current));
    }
  }, []);

  const patchStep = useCallback((stepId: string, patch: Partial<LiveStep>) => {
    setSteps(prev => {
      const next = prev.map(step => (step.id === stepId ? { ...step, ...patch } : step));
      const updated = next.find(step => step.id === stepId);
      if (updated) {
        clearTimeout(saveTimers.current[stepId]);
        saveTimers.current[stepId] = setTimeout(() => saveStep(updated), 700);
      }
      return next;
    });
  }, [saveStep]);

  const handleStartLiveGuide = useCallback(async () => {
    if (!targetUrlCount) {
      alert('라이브 가이드 Beta를 실행할 대상 URL이 없습니다. 먼저 스텝 URL을 저장해주세요.');
      return;
    }
    setLiveStarting(true);
    try {
      const token = await ensurePublished();
      const result = await startLiveGuide(token);
      if (result.ok) return;
      if (result.reason === 'gated' && result.upgradeUrl && confirm(`${result.message}\n설정 화면으로 이동할까요?`)) {
        window.location.href = result.upgradeUrl;
        return;
      }
      alert(result.message);
    } catch {
      alert('라이브 가이드 Beta 실행 준비에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLiveStarting(false);
    }
  }, [ensurePublished, targetUrlCount]);

  if (loading) {
    return <Shell><Loader2 size={18} className="spin" /> 불러오는 중<Styles /></Shell>;
  }

  if (error || !tutorial) {
    return <Shell>매뉴얼을 불러올 수 없습니다.</Shell>;
  }

  if (isViewer) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <p>이 매뉴얼을 편집할 권한이 없습니다.</p>
          <button onClick={() => router.push(`/manual/${id}`)} style={primaryBtn}>매뉴얼로 돌아가기</button>
        </div>
      </Shell>
    );
  }

  return (
    <div style={page}>
      <header style={header}>
        <button onClick={() => router.push(`/manual/${id}/editor`)} style={iconBtn} title="편집기로 돌아가기"><ArrowLeft size={ICON} /></button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>라이브 가이드 Beta 스튜디오</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.48)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tutorial.title}</div>
        </div>
        <div style={{ flex: 1 }} />
        <StatusPill label={`URL ${targetUrlCount}/${steps.length}`} tone={targetUrlCount ? '#34d399' : '#fbbf24'} />
        {unresolvedCount > 0 && <StatusPill label={`대상 없음 ${unresolvedCount}`} tone="#f87171" />}
        <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {savingId ? <><Loader2 size={ICON} className="spin" /> 저장 중</> : savedTick > 0 ? <><Check size={ICON} color="#34d399" /> 저장됨</> : null}
        </span>
        <button onClick={handleStartLiveGuide} disabled={liveStarting || publishing || !targetUrlCount} style={{ ...primaryBtn, opacity: liveStarting || publishing || !targetUrlCount ? 0.55 : 1 }}>
          {liveStarting ? <Loader2 size={ICON} className="spin" /> : <Zap size={ICON} />} Beta 실행
        </button>
      </header>

      <div style={body}>
        <aside style={rail}>
          {steps.map((step, index) => {
            const selected = step.id === activeId;
            const h = health(step);
            return (
              <button key={step.id} onClick={() => setActiveId(step.id)} style={{ ...stepItem, ...(selected ? selectedStep : null) }}>
                <span style={{ ...stepNo, background: selected ? '#4f46e5' : 'rgba(255,255,255,0.1)' }}>{index + 1}</span>
                <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <span style={stepTitle}>{step.title}</span>
                  <span style={{ ...stepMeta, color: h.color }}>{h.label}</span>
                </span>
              </button>
            );
          })}
        </aside>

        <main style={main}>
          {!active ? (
            <div style={empty}>스텝을 선택해주세요.</div>
          ) : (
            <>
              <section style={summaryBand}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.46)' }}>Step {steps.findIndex(step => step.id === active.id) + 1}</div>
                  <h1 style={{ margin: '3px 0 6px', fontSize: 22, lineHeight: 1.25 }}>{active.title}</h1>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.62)', fontSize: 13.5, lineHeight: 1.55 }}>{active.instruction || '설명 없음'}</p>
                </div>
                <StatusPill label={health(active).label} tone={health(active).color} />
              </section>

              <section style={panel}>
                <SectionTitle>실행 URL</SectionTitle>
                <div style={row}>
                  <input value={active.pageUrl} onChange={e => patchStep(active.id, { pageUrl: e.target.value })} placeholder="https://example.com/path" style={input} />
                  <button disabled={!active.pageUrl.trim()} onClick={() => window.open(active.pageUrl, '_blank', 'noopener,noreferrer')} style={{ ...ghostBtn, width: 38, opacity: active.pageUrl.trim() ? 1 : 0.45 }} title="대상 페이지 열기">
                    <ExternalLink size={ICON} />
                  </button>
                </div>
                <p style={hint}>라이브 가이드 Beta는 이 URL에서 시작한 뒤 각 스텝의 DOM 대상을 순서대로 찾습니다.</p>
              </section>

              <section style={panel}>
                <SectionTitle>DOM 대상</SectionTitle>
                <label style={label}>CSS selector</label>
                <textarea value={active.selector} onChange={e => patchStep(active.id, { selector: e.target.value })} placeholder='button[aria-label="Send"]' rows={2} style={textarea} />
                <label style={label}>XPath</label>
                <textarea value={active.xpath} onChange={e => patchStep(active.id, { xpath: e.target.value })} placeholder='//button[normalize-space(.)="Send"]' rows={2} style={textarea} />
                <p style={hint}>selector가 가장 먼저 사용되고, 실패하면 XPath와 시각적 fallback으로 내려갑니다.</p>
              </section>

              <section style={panel}>
                <SectionTitle>Fallback 위치</SectionTitle>
                <div style={grid4}>
                  <NumberField label="Rect X" value={active.rect.x} onChange={value => patchStep(active.id, { rect: { ...active.rect, x: value } })} />
                  <NumberField label="Rect Y" value={active.rect.y} onChange={value => patchStep(active.id, { rect: { ...active.rect, y: value } })} />
                  <NumberField label="Width" value={active.rect.width} onChange={value => patchStep(active.id, { rect: { ...active.rect, width: value } })} />
                  <NumberField label="Height" value={active.rect.height} onChange={value => patchStep(active.id, { rect: { ...active.rect, height: value } })} />
                </div>
                <div style={{ ...grid4, gridTemplateColumns: '1fr 1fr auto auto', marginTop: 10 }}>
                  <NumberField label="Click X" value={active.clickX} onChange={value => patchStep(active.id, { clickX: value })} />
                  <NumberField label="Click Y" value={active.clickY} onChange={value => patchStep(active.id, { clickY: value })} />
                  <button onClick={() => patchStep(active.id, { rect: { x: '', y: '', width: '', height: '' } })} style={subtleBtn}><RotateCcw size={12} /> Rect</button>
                  <button onClick={() => patchStep(active.id, { clickX: '', clickY: '' })} style={subtleBtn}><RotateCcw size={12} /> Click</button>
                </div>
                <p style={hint}>0~1 값 또는 0~100 퍼센트 값을 입력할 수 있습니다. 저장 시 0~1 기준으로 정규화됩니다.</p>
              </section>

              <section style={panel}>
                <SectionTitle>검증 흐름</SectionTitle>
                <div style={flow}>
                  {['URL 이동', 'Selector', 'XPath', 'Rect', 'Click 좌표'].map((item, index) => (
                    <span key={item} style={flowStep}><MousePointerClick size={12} /> {index + 1}. {item}</span>
                  ))}
                </div>
                <p style={hint}>{health(active).detail}</p>
                <button onClick={() => saveStep(active)} disabled={savingId === active.id} style={{ ...primaryBtn, marginTop: 12 }}>
                  {savingId === active.id ? <Loader2 size={ICON} className="spin" /> : <Save size={ICON} />} 지금 저장
                </button>
              </section>
            </>
          )}
        </main>
      </div>
      <Styles />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'grid', gap: 5 }}>
      <span style={labelStyle}>{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} inputMode="decimal" placeholder="0.5" style={input} />
    </label>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.48)', marginBottom: 10 }}>{children}</div>;
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <span style={{ color: tone, border: `1px solid ${tone}55`, background: `${tone}18`, borderRadius: 999, padding: '5px 9px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>;
}

function Shell({ children }: { children: ReactNode }) {
  return <div style={{ ...page, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.72)' }}>{children}</div>;
}

function Styles() {
  return <style>{`.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>;
}

const page: CSSProperties = { position: 'fixed', inset: 0, background: '#0A0A0F', color: 'white', fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", overflow: 'hidden' };
const header: CSSProperties = { height: 56, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,10,15,0.94)' };
const body: CSSProperties = { height: 'calc(100vh - 56px)', display: 'flex', minHeight: 0 };
const rail: CSSProperties = { width: 250, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto', padding: 10 };
const main: CSSProperties = { flex: 1, minWidth: 0, overflowY: 'auto', padding: 24, display: 'grid', alignContent: 'start', gap: 14 };
const iconBtn: CSSProperties = { width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.13)', background: 'transparent', color: 'rgba(255,255,255,0.82)', cursor: 'pointer', display: 'grid', placeItems: 'center' };
const primaryBtn: CSSProperties = { minHeight: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: 'white', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
const ghostBtn: CSSProperties = { height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.13)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.78)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
const subtleBtn: CSSProperties = { height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.13)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12 };
const stepItem: CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 9, border: '1px solid transparent', borderRadius: 9, background: 'transparent', color: 'white', cursor: 'pointer', padding: '8px 7px', marginBottom: 5 };
const selectedStep: CSSProperties = { borderColor: 'rgba(96,165,250,0.56)', background: 'rgba(37,99,235,0.14)' };
const stepNo: CSSProperties = { width: 24, height: 24, borderRadius: 7, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 };
const stepTitle: CSSProperties = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 700 };
const stepMeta: CSSProperties = { display: 'block', marginTop: 2, fontSize: 10.8, fontWeight: 700 };
const summaryBand: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: 18, background: 'rgba(255,255,255,0.035)' };
const panel: CSSProperties = { border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: 16, background: 'rgba(255,255,255,0.035)' };
const row: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: 'white', WebkitTextFillColor: 'white', caretColor: '#93c5fd', padding: '9px 10px', outline: 'none', fontSize: 12.5, fontFamily: 'inherit' };
const textarea: CSSProperties = { ...input, resize: 'vertical', lineHeight: 1.45 };
const label: CSSProperties = { display: 'block', margin: '11px 0 5px', color: 'rgba(255,255,255,0.56)', fontSize: 11.5, fontWeight: 700 };
const labelStyle: CSSProperties = { color: 'rgba(255,255,255,0.56)', fontSize: 11.5, fontWeight: 700 };
const hint: CSSProperties = { margin: '8px 0 0', color: 'rgba(255,255,255,0.43)', fontSize: 11.5, lineHeight: 1.5 };
const grid4: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 };
const flow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const flowStep: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.74)', fontSize: 12 };
const empty: CSSProperties = { color: 'rgba(255,255,255,0.45)', fontSize: 13, alignSelf: 'center', justifySelf: 'center' };

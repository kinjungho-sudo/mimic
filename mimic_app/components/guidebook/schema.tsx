'use client';

// 가이드북 공유 스키마 — BlockNote 기본 블록 + 커스텀 "가이드 임베드" 블록.
// 같은 블록 스펙을 편집기/공개뷰가 공유하며, GuideContext.mode 로 렌더를 분기한다.

import { createContext, useContext, useState } from 'react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { AnnotationPreview } from '@/components/editor/AnnotationPreview';
import type { Annotation } from '@/components/editor/ImageAnnotationEditor';

export type GuideStep = {
  step_number: number;
  title: string;
  caption: string;
  screenshot_url: string | null;
  annotations: Annotation[];
};
export type GuideData = { id: string; title: string; steps: GuideStep[] };

type GuideCtx = {
  mode: 'edit' | 'view';
  tutorials: { id: string; title: string }[]; // 편집 모드: 선택 가능한 가이드 목록
  guides: Record<string, GuideData | null>;   // 보기 모드: 서버 enrich 된 본문
};
export const GuideContext = createContext<GuideCtx>({ mode: 'view', tutorials: [], guides: {} });

// ── 가이드 블록 렌더 (모드 분기) ──
function GuideBlockRender(props: {
  block: { props: { tutorialId: string; defaultOpen: boolean } };
  editor: { updateBlock: (block: unknown, update: unknown) => void };
}) {
  const ctx = useContext(GuideContext);
  const { tutorialId, defaultOpen } = props.block.props;

  if (ctx.mode === 'edit') {
    return (
      <GuideEditCard
        tutorialId={tutorialId}
        defaultOpen={defaultOpen}
        tutorials={ctx.tutorials}
        onChange={patch =>
          props.editor.updateBlock(props.block, { type: 'guide', props: { tutorialId, defaultOpen, ...patch } })
        }
      />
    );
  }
  return <GuideViewCard defaultOpen={defaultOpen} guide={ctx.guides[tutorialId] ?? null} />;
}

const guideSpec = createReactBlockSpec(
  {
    type: 'guide',
    propSchema: { tutorialId: { default: '' }, defaultOpen: { default: false } },
    content: 'none',
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { render: GuideBlockRender as any },
);

export const guidebookSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    guide: guideSpec,
  },
  // 커스텀 블록 스펙 제네릭 추론 우회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

// ── 편집 모드 카드 ──
function GuideEditCard({ tutorialId, defaultOpen, tutorials, onChange }: {
  tutorialId: string;
  defaultOpen: boolean;
  tutorials: { id: string; title: string }[];
  onChange: (patch: { tutorialId?: string; defaultOpen?: boolean }) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const title = tutorials.find(t => t.id === tutorialId)?.title;

  return (
    <div contentEditable={false} style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '12px 14px', background: '#FAFAFA', margin: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EEF2FF', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4338CA" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: tutorialId ? '#111827' : '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tutorialId ? `📘 ${title ?? '가이드'}` : '가이드를 선택하세요'}
          </div>
          <div style={{ fontSize: '11.5px', color: '#9CA3AF' }}>가이드 임베드 (보기 페이지에서 펼쳐짐)</div>
        </div>
        <button onClick={() => setPickerOpen(true)}
          style={{ height: '30px', padding: '0 12px', borderRadius: '7px', border: '1px solid #C7D2FE', background: 'white', color: '#4338CA', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          {tutorialId ? '변경' : '선택'}
        </button>
      </div>
      {tutorialId && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280', cursor: 'pointer', marginTop: '10px' }}>
          <input type="checkbox" checked={defaultOpen} onChange={e => onChange({ defaultOpen: e.target.checked })} />
          기본 펼침
        </label>
      )}

      {pickerOpen && (
        <GuidePicker
          tutorials={tutorials}
          onPick={t => { onChange({ tutorialId: t.id }); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function GuidePicker({ tutorials, onPick, onClose }: {
  tutorials: { id: string; title: string }[];
  onPick: (t: { id: string; title: string }) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const filtered = tutorials.filter(t => (t.title ?? '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '480px', maxWidth: 'calc(100vw - 32px)', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 12px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>가이드 선택</div>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="가이드 검색…"
            style={{ width: '100%', height: '38px', padding: '0 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>가이드가 없습니다.</div>
          ) : filtered.map(t => (
            <button key={t.id} onClick={() => onPick(t)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', border: 'none', borderRadius: '8px', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ fontSize: '15px' }}>📘</span>
              <span style={{ flex: 1, fontSize: '13.5px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || '제목 없음'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 보기 모드 카드 (접기/펼치기 + 인라인 스텝) ──
function GuideViewCard({ defaultOpen, guide }: { defaultOpen: boolean; guide: GuideData | null }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!guide) {
    return (
      <div contentEditable={false} style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px 16px', margin: '8px 0', fontSize: '13px', color: '#9CA3AF' }}>
        가이드를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div contentEditable={false} style={{ border: '1px solid #E5E7EB', borderRadius: '12px', margin: '8px 0', overflow: 'hidden', background: 'white' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 16px', border: 'none', background: open ? '#FAFAFA' : 'white', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#EEF2FF', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4338CA" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📘 {guide.title}</span>
          <span style={{ display: 'block', fontSize: '11.5px', color: '#9CA3AF' }}>{guide.steps.length}단계 가이드</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#4338CA', fontWeight: 600, flexShrink: 0 }}>
          {open ? '접기' : '펼치기'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #F3F4F6', padding: '8px 0' }}>
          {guide.steps.map((s, i) => (
            <div key={i} style={{ padding: '14px 18px', borderBottom: i < guide.steps.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: s.screenshot_url ? '10px' : 0 }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#3730a3', color: 'white', fontSize: '12px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  {s.title && <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{s.title}</div>}
                  {s.caption && <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6, marginTop: '2px' }}>{s.caption}</div>}
                </div>
              </div>
              {s.screenshot_url && (
                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #F3F4F6' }}>
                  <AnnotationPreview imageUrl={s.screenshot_url} annotations={s.annotations ?? []} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

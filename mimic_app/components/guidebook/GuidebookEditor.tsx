'use client';

import { useMemo } from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  SideMenuController,
  SideMenu,
  DragHandleButton,
  DragHandleMenu,
  RemoveBlockItem,
  BlockColorsItem,
  AddBlockButton,
  useBlockNoteEditor,
  useExtensionState,
} from '@blocknote/react';
import { filterSuggestionItems } from '@blocknote/core';
import { SideMenuExtension } from '@blocknote/core/extensions';
import { ko } from '@blocknote/core/locales';
import { guidebookSchema, GuideContext } from './schema';

// #4: 드래그 핸들 메뉴에서 블록 유형 변환
function TurnIntoSection() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useBlockNoteEditor<any, any, any>();
  const block = useExtensionState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SideMenuExtension as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { selector: (state: any) => state?.block },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  if (!block) return null;

  const types = [
    { label: '단락', type: 'paragraph', props: {} },
    { label: '제목 1', type: 'heading', props: { level: 1 } },
    { label: '제목 2', type: 'heading', props: { level: 2 } },
    { label: '제목 3', type: 'heading', props: { level: 3 } },
    { label: '불릿 목록', type: 'bulletListItem', props: {} },
    { label: '번호 목록', type: 'numberedListItem', props: {} },
    { label: '할 일 목록', type: 'checkListItem', props: {} },
    { label: '코드', type: 'codeBlock', props: {} },
    { label: '인용', type: 'quote', props: {} },
  ];

  return (
    <>
      <div style={{ padding: '4px 10px 2px', fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        변환
      </div>
      {types.map(t => (
        <button
          key={`${t.type}-${t.label}`}
          className="bn-menu-item"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={() => { editor.updateBlock(block, { type: t.type as any, props: t.props as any }); }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '5px 10px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: '12px', color: '#374151' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {t.label}
        </button>
      ))}
      <div style={{ borderTop: '1px solid #F3F4F6', margin: '4px 0' }} />
    </>
  );
}

export default function GuidebookEditor({ initialContent, tutorials, onChange }: {
  initialContent: unknown[];
  tutorials: { id: string; title: string }[];
  onChange: (doc: unknown[]) => void;
}) {
  const editor = useCreateBlockNote({
    schema: guidebookSchema,
    dictionary: ko,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: (initialContent && initialContent.length ? initialContent : undefined) as any,
    uploadFile: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/pages/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('업로드 실패');
      const { url } = await res.json();
      return url as string;
    },
  });

  const ctx = useMemo(() => ({ mode: 'edit' as const, tutorials, guides: {} }), [tutorials]);

  return (
    <GuideContext.Provider value={ctx}>
      <style>{`
        /* #1: 사이드 핸들 색상을 더 진하게 */
        .bn-side-menu .mantine-UnstyledButton-root:not(.mantine-Menu-item) svg {
          color: #9CA3AF !important;
        }
        .bn-side-menu .mantine-UnstyledButton-root:hover svg {
          color: #374151 !important;
        }
        /* #7: 슬래시 메뉴가 viewport 하단에서 위로 열리도록 — floating-ui가 자동 처리하지만 z-index 보정 */
        .bn-suggestion-menu {
          z-index: 9999 !important;
        }
      `}</style>
      <BlockNoteView
        editor={editor}
        slashMenu={false}
        sideMenu={false}
        theme="light"
        onChange={() => onChange(editor.document)}
      >
        {/* #4: 드래그 핸들(::) 클릭 시 블록 유형 변환 메뉴 표시 */}
        <SideMenuController
          sideMenu={(props) => (
            <SideMenu {...props}>
              <AddBlockButton />
              <DragHandleButton {...props} dragHandleMenu={(menuProps) => (
                <DragHandleMenu {...menuProps}>
                  <TurnIntoSection />
                  <BlockColorsItem>색상</BlockColorsItem>
                  <RemoveBlockItem {...menuProps}>삭제</RemoveBlockItem>
                </DragHandleMenu>
              )} />
            </SideMenu>
          )}
        />

        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async query =>
            filterSuggestionItems(
              [
                // 토글 제목(toggle_heading*) 변형 제거
                ...getDefaultReactSlashMenuItems(editor).filter(
                  it => !String((it as { key?: string }).key ?? '').startsWith('toggle_heading'),
                ),
                {
                  title: '가이드 임베드',
                  subtext: '내 매뉴얼을 이 문서에 삽입',
                  aliases: ['guide', '가이드', '매뉴얼', 'embed'],
                  group: '임베드',
                  onItemClick: () => {
                    const ref = editor.getTextCursorPosition().block;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    editor.insertBlocks([{ type: 'guide' } as any], ref, 'after');
                  },
                },
              ],
              query,
            )
          }
        />
      </BlockNoteView>
    </GuideContext.Provider>
  );
}

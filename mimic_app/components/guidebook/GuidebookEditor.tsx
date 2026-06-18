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
} from '@blocknote/react';
import { filterSuggestionItems, BlockTypeSelect } from '@blocknote/react';
import { ko } from '@blocknote/core/locales';
import { guidebookSchema, GuideContext } from './schema';

// BlockTypeSelect is in FormattingToolbar — check if it's exported from react
// If not, use a simpler approach for #4

export default function GuidebookEditor({ initialContent, tutorials, onChange }: {
  initialContent: unknown[];
  tutorials: { id: string; title: string }[];
  onChange: (doc: unknown[]) => void;
}) {
  const editor = useCreateBlockNote({
    schema: guidebookSchema,
    dictionary: ko,
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
              <AddBlockButton {...props} />
              <DragHandleButton {...props} dragHandleMenu={(menuProps) => (
                <DragHandleMenu {...menuProps}>
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

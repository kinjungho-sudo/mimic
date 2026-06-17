'use client';

import { useMemo } from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { filterSuggestionItems } from '@blocknote/core';
import { guidebookSchema, GuideContext } from './schema';

export default function GuidebookEditor({ initialContent, tutorials, onChange }: {
  initialContent: unknown[];
  tutorials: { id: string; title: string }[];
  onChange: (doc: unknown[]) => void;
}) {
  const editor = useCreateBlockNote({
    schema: guidebookSchema,
    // 빈 문서는 undefined 로 넘겨야 함 (빈 배열은 오류)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: (initialContent && initialContent.length ? initialContent : undefined) as any,
  });

  const ctx = useMemo(() => ({ mode: 'edit' as const, tutorials, guides: {} }), [tutorials]);

  return (
    <GuideContext.Provider value={ctx}>
      <BlockNoteView
        editor={editor}
        slashMenu={false}
        theme="light"
        onChange={() => onChange(editor.document)}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async query =>
            filterSuggestionItems(
              [
                ...getDefaultReactSlashMenuItems(editor),
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

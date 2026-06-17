'use client';

import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useCreateBlockNote } from '@blocknote/react';
import { guidebookSchema, GuideContext, type GuideData } from './schema';

export default function GuidebookView({ content, guides }: {
  content: unknown[];
  guides: Record<string, GuideData | null>;
}) {
  const editor = useCreateBlockNote({
    schema: guidebookSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: (content && content.length ? content : undefined) as any,
  });

  return (
    <GuideContext.Provider value={{ mode: 'view', tutorials: [], guides }}>
      <BlockNoteView editor={editor} editable={false} theme="light" />
    </GuideContext.Provider>
  );
}

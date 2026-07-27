'use client';

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
} from '@blocknote/react';
import { filterSuggestionItems } from '@blocknote/core';
import { SideMenuExtension } from '@blocknote/core/extensions';
import { ko } from '@blocknote/core/locales';
import { guidebookSchema, GuideContext } from './schema';
import { createClient } from '@/lib/supabase/client';

const PLAYBOOK_UPLOAD_LIMITS = {
  image: 20 * 1024 * 1024,
  video: 50 * 1024 * 1024,
} as const;

const PLAYBOOK_UPLOAD_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
};

type AddMenuAnchor = { left: number; top: number; bottom: number };

function ViewportSafeAddBlockButton({ onOpen }: {
  onOpen: (block: unknown, anchor: AddMenuAnchor) => void;
}) {
  const components = useComponentsContext();
  const block = useExtensionState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SideMenuExtension as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { selector: (state: any) => state?.block },
  );
  if (!block || !components) return null;

  return (
    <components.SideMenu.Button
      className="bn-button"
      label="블록 추가"
      icon={(
        <svg
          data-test="viewportSafeAddBlock"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          onMouseDown={event => {
            event.preventDefault();
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            onOpen(block, { left: rect.left, top: rect.top, bottom: rect.bottom });
          }}
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
    />
  );
}

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
  const supabase = useMemo(() => createClient(), []);
  // 이 편집기는 ssr:false로만 마운트되므로 첫 렌더부터 viewport 루트를 사용할 수 있다.
  // 포털 대상을 effect에서 뒤늦게 바꾸면 AddBlockButton이 연 메뉴가 유실될 수 있다.
  const [portalElement] = useState<HTMLElement | null>(() => document.body);
  const [addMenu, setAddMenu] = useState<{ anchor: AddMenuAnchor } | null>(null);

  const editor = useCreateBlockNote({
    schema: guidebookSchema,
    dictionary: ko,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: (initialContent && initialContent.length ? initialContent : undefined) as any,
    uploadFile: async (file: File) => {
      const ext = PLAYBOOK_UPLOAD_EXTENSIONS[file.type];
      if (!ext) {
        throw new Error('PNG, JPG, WebP, GIF, MP4, WebM, MOV 영상만 업로드할 수 있습니다.');
      }

      const kind = file.type.startsWith('video/') ? 'video' : 'image';
      const maxSize = PLAYBOOK_UPLOAD_LIMITS[kind];
      if (file.size > maxSize) {
        throw new Error(kind === 'video'
          ? '영상은 50MB 이하만 업로드할 수 있습니다.'
          : '이미지는 20MB 이하만 업로드할 수 있습니다.');
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('로그인 정보를 확인할 수 없습니다.');

      const path = `playbook-uploads/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('naviaction')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error('업로드에 실패했습니다.');

      const { data: { publicUrl } } = supabase.storage.from('naviaction').getPublicUrl(path);
      return publicUrl;
    },
  });

  const ctx = useMemo(() => ({ mode: 'edit' as const, tutorials, guides: {} }), [tutorials]);
  const menuItems = useMemo(() => [
    ...getDefaultReactSlashMenuItems(editor).filter(
      item => !String((item as { key?: string }).key ?? '').startsWith('toggle_heading'),
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
  ], [editor]);

  const openAddMenu = useCallback((rawBlock: unknown, anchor: AddMenuAnchor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = rawBlock as any;
    const content = block?.content;
    let target = block;
    if (!(Array.isArray(content) && content.length === 0)) {
      target = editor.insertBlocks([{ type: 'paragraph' }], block, 'after')[0];
    }
    editor.setTextCursorPosition(target);
    setAddMenu({ anchor });
  }, [editor]);

  const chooseAddMenuItem = useCallback((item: (typeof menuItems)[number]) => {
    setAddMenu(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item.onItemClick as any)(editor);
  }, [editor, menuItems]);

  const addMenuOverlay = addMenu && portalElement ? createPortal(
    <div
      role="presentation"
      onMouseDown={() => setAddMenu(null)}
      style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
    >
      <div
        role="menu"
        aria-label="블록 삽입"
        onMouseDown={event => event.stopPropagation()}
        style={{
          position: 'fixed',
          left: Math.max(12, Math.min(addMenu.anchor.left, window.innerWidth - 332)),
          ...(window.innerHeight - addMenu.anchor.bottom >= 280
            ? { top: addMenu.anchor.bottom + 8 }
            : { bottom: window.innerHeight - addMenu.anchor.top + 8 }),
          width: '320px',
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: `min(360px, calc(100dvh - 24px))`,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          padding: '6px',
          border: '1px solid #E5E7EB',
          borderRadius: '10px',
          background: 'white',
          boxShadow: '0 12px 32px rgba(17,24,39,0.16)',
        }}
      >
        {menuItems.map((item, index) => (
          <button
            key={`${String(item.title)}-${index}`}
            type="button"
            role="menuitem"
            onClick={() => chooseAddMenuItem(item)}
            style={{ width: '100%', minHeight: '44px', padding: '7px 9px', border: 'none', borderRadius: '7px', background: 'transparent', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', cursor: 'pointer', color: '#111827' }}
          >
            <span style={{ width: '28px', display: 'grid', placeItems: 'center', color: '#6B7280', flexShrink: 0 }}>{item.icon ?? null}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{item.title}</span>
              {item.subtext && <span style={{ display: 'block', marginTop: '1px', fontSize: '11px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subtext}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>,
    portalElement,
  ) : null;

  return (
    <GuideContext.Provider value={ctx}>
      {addMenuOverlay}
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
          max-height: min(360px, calc(100dvh - 24px)) !important;
          overflow-y: auto !important;
          overscroll-behavior: contain;
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
              <ViewportSafeAddBlockButton onOpen={openAddMenu} />
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
          portalElement={portalElement}
          floatingUIOptions={{ useFloatingOptions: { strategy: 'fixed' } }}
          getItems={async query =>
            filterSuggestionItems(
              menuItems,
              query,
            )
          }
        />
      </BlockNoteView>
    </GuideContext.Provider>
  );
}

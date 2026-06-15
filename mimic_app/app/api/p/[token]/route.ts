import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ token: string }> };

type StepRow = {
  id: string;
  tutorial_id: string;
  step_number: number;
  user_title: string | null;
  ai_title: string | null;
  user_script: string | null;
  ai_description: string | null;
  screenshot_url: string | null;
  user_annotations: unknown;
};

// GET /api/p/[token] — 공개 페이지 + 블록.
// tutorial 블록은 페이지 작성자(또는 동일 워크스페이스) 소유 가이드만 본문(steps)을 함께 내려준다.
export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: page } = await supabase
    .from('mm_pages')
    .select('id, user_id, workspace_id, title, description, cover_color, status, share_token, published_at')
    .eq('share_token', token)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single();

  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: blocks } = await supabase
    .from('mm_page_blocks')
    .select('*')
    .eq('page_id', page.id)
    .order('order_index', { ascending: true });

  const blockList = blocks ?? [];

  // tutorial 블록의 가이드 본문 enrich
  const tutorialIds = Array.from(new Set(
    blockList
      .filter(b => b.block_type === 'tutorial')
      .map(b => (b.content as { tutorial_id?: string })?.tutorial_id)
      .filter((v): v is string => typeof v === 'string')
  ));

  const tutorialMap = new Map<string, { id: string; title: string; steps: unknown[] }>();

  if (tutorialIds.length) {
    const { data: tutorials } = await supabase
      .from('mm_tutorials')
      .select('id, title, user_id, workspace_id')
      .in('id', tutorialIds)
      .is('deleted_at', null);

    // 페이지 작성자 소유 또는 동일 워크스페이스 가이드만 허용
    const allowed = (tutorials ?? []).filter(t =>
      t.user_id === page.user_id ||
      (page.workspace_id != null && t.workspace_id === page.workspace_id)
    );
    const allowedIds = allowed.map(t => t.id);

    let stepsByTutorial = new Map<string, StepRow[]>();
    if (allowedIds.length) {
      const { data: steps } = await supabase
        .from('mm_steps')
        .select('id, tutorial_id, step_number, user_title, ai_title, user_script, ai_description, screenshot_url, user_annotations')
        .in('tutorial_id', allowedIds)
        .order('step_number', { ascending: true });

      stepsByTutorial = (steps ?? []).reduce((acc, s) => {
        const arr = acc.get(s.tutorial_id) ?? [];
        arr.push(s as StepRow);
        acc.set(s.tutorial_id, arr);
        return acc;
      }, new Map<string, StepRow[]>());
    }

    for (const t of allowed) {
      const steps = (stepsByTutorial.get(t.id) ?? []).map(s => ({
        step_number: s.step_number,
        title: s.user_title ?? s.ai_title ?? '',
        caption: s.user_script ?? s.ai_description ?? '',
        screenshot_url: s.screenshot_url,
        annotations: s.user_annotations ?? [],
      }));
      tutorialMap.set(t.id, { id: t.id, title: t.title, steps });
    }
  }

  const enrichedBlocks = blockList.map(b => {
    if (b.block_type !== 'tutorial') return b;
    const tid = (b.content as { tutorial_id?: string })?.tutorial_id;
    return { ...b, tutorial: tid ? tutorialMap.get(tid) ?? null : null };
  });

  return NextResponse.json({
    id: page.id,
    title: page.title,
    description: page.description,
    cover_color: page.cover_color,
    published_at: page.published_at,
    blocks: enrichedBlocks,
  });
}

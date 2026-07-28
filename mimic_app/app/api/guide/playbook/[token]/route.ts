import { NextRequest, NextResponse } from 'next/server';
import { fetchLiveGuideSteps, gateLiveGuide } from '@/lib/live-guide/server';
import { extractPlaybookGuideSequence, flattenPlaybookLiveGuideSteps } from '@/lib/live-guide/playbook';
import { isPaidPlan } from '@/lib/plan';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { maskManualCopy } from '@/lib/manual-quality';

type Params = { params: Promise<{ token: string }> };

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
};

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: RESPONSE_HEADERS });
}

// 게시된 플레이북의 가이드 블록을 문서 순서대로 펼쳐 하나의 Live Guide로 반환한다.
// 같은 매뉴얼이 여러 번 배치된 경우도 해당 위치마다 다시 포함한다.
export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: page } = await supabase
    .from('mm_pages')
    .select('id, user_id, workspace_id, title, content')
    .eq('share_token', token)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single();

  if (!page) return json({ error: 'Not found' }, 404);

  const gated = await gateLiveGuide(supabase, page.user_id);
  if (gated) return json(gated);

  const sequence = extractPlaybookGuideSequence(page.content);
  if (!sequence.length) {
    return json({
      tutorial_id: page.id,
      title: maskManualCopy(page.title),
      source: 'playbook',
      manual_count: 0,
      steps: [],
    });
  }

  const uniqueIds = Array.from(new Set(sequence));
  const { data: tutorials } = await supabase
    .from('mm_tutorials')
    .select('id, title, user_id, workspace_id, tts_enabled')
    .in('id', uniqueIds)
    .is('deleted_at', null);

  const allowed = (tutorials ?? []).filter(tutorial =>
    tutorial.user_id === page.user_id
    || (page.workspace_id != null && tutorial.workspace_id === page.workspace_id)
  );

  const loaded = await Promise.all(allowed.map(tutorial =>
    fetchLiveGuideSteps(
      supabase,
      tutorial.id,
      tutorial.title,
      tutorial.user_id,
      !!tutorial.tts_enabled,
    )
  ));
  const guides = new Map(loaded.map(guide => [guide.tutorial_id, guide]));
  const steps = flattenPlaybookLiveGuideSteps(sequence, guides);

  const { data: owner } = await supabase
    .from('mm_users')
    .select('plan')
    .eq('id', page.user_id)
    .single();

  return json({
    tutorial_id: page.id,
    title: maskManualCopy(page.title),
    source: 'playbook',
    manual_count: allowed.length,
    tts_enabled: loaded.some(guide => guide.tts_enabled),
    survey: {
      enabled: !isPaidPlan(owner?.plan ?? 'free'),
      context: 'live_guide',
    },
    steps,
  });
}

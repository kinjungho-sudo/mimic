import { isPaidPlan } from '@/lib/plan';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { maskManualCopy } from '@/lib/manual-quality';
import { fetchLiveGuideSteps, gateLiveGuide } from '@/lib/live-guide/server';
import { extractPlaybookGuideSequence, flattenPlaybookLiveGuideSteps } from '@/lib/live-guide/playbook';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export type PlaybookLiveGuideResult = {
  status: number;
  payload: unknown;
};

export async function resolvePublishedPlaybookLiveGuide(
  token: string,
  supabase: ServiceClient = createServiceRoleClient(),
): Promise<PlaybookLiveGuideResult> {
  const { data: page } = await supabase
    .from('mm_pages')
    .select('id, user_id, workspace_id, title, content')
    .eq('share_token', token)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single();

  if (!page) return { status: 404, payload: { error: 'Not found' } };

  const gated = await gateLiveGuide(supabase, page.user_id);
  if (gated) return { status: 200, payload: gated };

  const sequence = extractPlaybookGuideSequence(page.content);
  if (!sequence.length) {
    return {
      status: 200,
      payload: {
        tutorial_id: page.id,
        title: maskManualCopy(page.title),
        source: 'playbook',
        manual_count: 0,
        steps: [],
      },
    };
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

  return {
    status: 200,
    payload: {
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
    },
  };
}

import type { createServiceRoleClient } from '@/lib/supabase/server';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/** Viewer analytics may reference a manual or a playbook page (playbook Live Guide surveys). */
export async function isKnownGuideId(supabase: ServiceClient, id: string): Promise<boolean> {
  const [tutorial, page] = await Promise.all([
    supabase.from('mm_tutorials').select('id').eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('mm_pages').select('id').eq('id', id).is('deleted_at', null).maybeSingle(),
  ]);
  return Boolean(tutorial.data || page.data);
}

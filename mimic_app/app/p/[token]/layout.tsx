import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { buildMissingShareMetadata, buildPlaybookShareMetadata } from '@/lib/share-metadata';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from('mm_pages')
    .select('title, description')
    .eq('share_token', token)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single();

  if (!data) return buildMissingShareMetadata('플레이북');

  return buildPlaybookShareMetadata({
    token,
    title: data.title,
    description: data.description,
  });
}

export default function PublicPlaybookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

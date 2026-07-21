import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { buildManualShareMetadata, buildMissingShareMetadata } from '@/lib/share-metadata';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from('mm_tutorials')
    .select('title, thumbnail_url, visibility, share_password')
    .eq('share_token', token)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single();

  if (!data) {
    return buildMissingShareMetadata('매뉴얼');
  }

  return buildManualShareMetadata({
    token,
    title: data.title,
    thumbnailUrl: data.thumbnail_url,
    visibility: data.visibility,
    passwordProtected: Boolean(data.share_password),
  });
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

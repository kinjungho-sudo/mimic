import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { BRAND_NAME, getBrandAppUrl } from '@/lib/brand';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from('mm_tutorials')
    .select('title, thumbnail_url')
    .eq('share_token', token)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single();

  if (!data) {
    return { title: `${BRAND_NAME} 매뉴얼` };
  }

  const title = `${data.title} — ${BRAND_NAME} 매뉴얼`;
  const description = `${BRAND_NAME}으로 만든 단계별 인터랙티브 매뉴얼입니다.`;
  const appUrl = getBrandAppUrl();
  const pageUrl = `${appUrl}/play/${token}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: 'website',
      ...(data.thumbnail_url ? { images: [{ url: data.thumbnail_url, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: data.thumbnail_url ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(data.thumbnail_url ? { images: [data.thumbnail_url] } : {}),
    },
  };
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';

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
    return { title: '포리 매뉴얼' };
  }

  const title = `${data.title} — 포리 매뉴얼`;
  const description = '포리로 만든 단계별 인터랙티브 매뉴얼입니다.';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mimic-nine-ashen.vercel.app';
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

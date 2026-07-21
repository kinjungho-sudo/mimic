import type { Metadata } from 'next';
import { BRAND_NAME, getBrandAppUrl } from '@/lib/brand';

const PRIVATE_SHARE_ROBOTS: Metadata['robots'] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

const PUBLIC_SHARE_ROBOTS: Metadata['robots'] = {
  index: true,
  follow: true,
};

function compactDescription(value: string | null | undefined, fallback: string): string {
  const compact = value?.replace(/\s+/g, ' ').trim();
  if (!compact) return fallback;
  return compact.length <= 160 ? compact : `${compact.slice(0, 157).trimEnd()}…`;
}

function ogImageUrl(title: string, description: string): string {
  const appUrl = getBrandAppUrl();
  const query = new URLSearchParams({ title, sub: description });
  return `${appUrl}/api/og?${query.toString()}`;
}

function socialMetadata(
  title: string,
  description: string,
  url: string,
  imageUrl: string,
): Pick<Metadata, 'openGraph' | 'twitter'> {
  return {
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      siteName: BRAND_NAME,
      locale: 'ko_KR',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export function buildManualShareMetadata(input: {
  token: string;
  title: string;
  thumbnailUrl?: string | null;
  visibility?: 'private' | 'public' | null;
  passwordProtected?: boolean;
}): Metadata {
  const appUrl = getBrandAppUrl();
  const url = `${appUrl}/play/${input.token}`;
  const protectedTitle = `비밀번호로 보호된 ${BRAND_NAME} 매뉴얼`;
  const title = input.passwordProtected
    ? protectedTitle
    : `${input.title} — ${BRAND_NAME} 매뉴얼`;
  const description = input.passwordProtected
    ? `비밀번호를 입력하면 ${BRAND_NAME} 매뉴얼을 볼 수 있습니다.`
    : `${BRAND_NAME}로 만든 단계별 인터랙티브 매뉴얼입니다.`;
  const imageUrl = !input.passwordProtected && input.thumbnailUrl
    ? input.thumbnailUrl
    : ogImageUrl(input.passwordProtected ? protectedTitle : input.title, description);
  const indexable = input.visibility === 'public' && !input.passwordProtected;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: indexable ? PUBLIC_SHARE_ROBOTS : PRIVATE_SHARE_ROBOTS,
    ...socialMetadata(title, description, url, imageUrl),
  };
}

export function buildPlaybookShareMetadata(input: {
  token: string;
  title: string;
  description?: string | null;
}): Metadata {
  const appUrl = getBrandAppUrl();
  const url = `${appUrl}/p/${input.token}`;
  const title = `${input.title} — ${BRAND_NAME} 플레이북`;
  const description = compactDescription(
    input.description,
    `${BRAND_NAME}로 만든 실무 플레이북입니다.`,
  );
  const imageUrl = ogImageUrl(input.title, description);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: PUBLIC_SHARE_ROBOTS,
    ...socialMetadata(title, description, url, imageUrl),
  };
}

export function buildMissingShareMetadata(label: '매뉴얼' | '플레이북'): Metadata {
  return {
    title: { absolute: `${BRAND_NAME} ${label}` },
    robots: PRIVATE_SHARE_ROBOTS,
  };
}

export function buildEmbedMetadata(token: string): Metadata {
  const appUrl = getBrandAppUrl();
  return {
    title: { absolute: `${BRAND_NAME} 임베드 매뉴얼` },
    alternates: { canonical: `${appUrl}/play/${token}` },
    robots: PRIVATE_SHARE_ROBOTS,
  };
}

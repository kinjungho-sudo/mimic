import type { Metadata } from 'next';
import {
  BRAND_CANONICAL_URL,
  BRAND_DESCRIPTION,
  BRAND_NAME,
  BRAND_NAME_KO,
  isSearchIndexingEnabled,
} from '@/lib/brand';
import { LANDING_FAQS } from '@/lib/landing-faq';

const APP_URL = BRAND_CANONICAL_URL;
const LANDING_URL = `${APP_URL}/landingpage`;
const LANDING_TITLE = 'AI 업무 매뉴얼 제작과 라이브 가이드';
const SEARCH_INDEXING_ENABLED = isSearchIndexingEnabled();
const OG_IMAGE_URL = `${APP_URL}/api/og?title=${encodeURIComponent(LANDING_TITLE)}&sub=${encodeURIComponent('화면 녹화 한 번으로 업무 절차를 기록하고 실행까지 안내하세요')}`;

export const metadata: Metadata = {
  title: LANDING_TITLE,
  description: BRAND_DESCRIPTION,
  keywords: [
    'AI 업무 매뉴얼',
    '업무 매뉴얼 제작',
    'SOP 제작',
    '화면 녹화',
    '소프트웨어 온보딩',
    '사용자 가이드',
    '라이브 가이드',
    'Parro',
    '패로',
  ],
  alternates: {
    canonical: LANDING_URL,
    languages: {
      'ko-KR': LANDING_URL,
      'x-default': LANDING_URL,
    },
  },
  robots: {
    index: SEARCH_INDEXING_ENABLED,
    follow: SEARCH_INDEXING_ENABLED,
    googleBot: {
      index: SEARCH_INDEXING_ENABLED,
      follow: SEARCH_INDEXING_ENABLED,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: `${LANDING_TITLE} | ${BRAND_NAME}`,
    description: BRAND_DESCRIPTION,
    url: LANDING_URL,
    type: 'website',
    siteName: BRAND_NAME,
    locale: 'ko_KR',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} | ${LANDING_TITLE}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${LANDING_TITLE} | ${BRAND_NAME}`,
    description: BRAND_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};

const landingJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${APP_URL}/#website`,
      url: APP_URL,
      name: BRAND_NAME,
      alternateName: BRAND_NAME_KO,
      description: BRAND_DESCRIPTION,
      inLanguage: 'ko-KR',
      publisher: { '@id': `${APP_URL}/#organization` },
    },
    {
      '@type': 'Service',
      '@id': `${LANDING_URL}#service`,
      name: `${BRAND_NAME} AI 업무 매뉴얼 및 라이브 가이드`,
      serviceType: 'AI 기반 업무 매뉴얼 제작 및 화면 위 실행 안내',
      description: BRAND_DESCRIPTION,
      url: LANDING_URL,
      provider: { '@id': `${APP_URL}/#organization` },
      audience: {
        '@type': 'BusinessAudience',
        audienceType: '소프트웨어 교육, 업무 온보딩, 고객 지원 담당자와 팀',
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${LANDING_URL}#faq`,
      mainEntity: LANDING_FAQS.map(faq => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.a,
        },
      })),
    },
  ],
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd) }}
      />
      {children}
    </>
  );
}

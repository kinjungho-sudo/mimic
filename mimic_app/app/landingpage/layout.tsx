import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import {
  BRAND_CANONICAL_URL,
  BRAND_NAME,
  BRAND_NAME_KO,
  isSearchIndexingEnabled,
} from '@/lib/brand';

const LANDING_URL = `${BRAND_CANONICAL_URL}/landingpage`;
const LANDING_TITLE = 'Parro EDU | 한 번의 시연을 직접 해보는 실습으로';
const LANDING_DESCRIPTION =
  '강사의 화면 시연을 AI 실습 가이드로 만들고, 공유하고, 학습자가 자기 화면에서 직접 따라 하도록 연결하는 교육 플랫폼';
const SEARCH_INDEXING_ENABLED = isSearchIndexingEnabled();
const OG_IMAGE_URL = `${BRAND_CANONICAL_URL}/api/og?title=${encodeURIComponent(LANDING_TITLE)}&sub=${encodeURIComponent(LANDING_DESCRIPTION)}`;

const eduSans = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-edu-sans',
  display: 'swap',
  weight: ['500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: LANDING_TITLE,
  description: LANDING_DESCRIPTION,
  keywords: [
    'AI 실습 가이드',
    '강사 수업 도구',
    '수강생 실습',
    'KDT 교육',
    '기업 교육',
    'Parro EDU',
    'Parro',
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
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    url: LANDING_URL,
    type: 'website',
    siteName: BRAND_NAME,
    locale: 'ko_KR',
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: LANDING_TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};

const landingJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${BRAND_CANONICAL_URL}/#website`,
      url: BRAND_CANONICAL_URL,
      name: BRAND_NAME,
      alternateName: BRAND_NAME_KO,
      description: LANDING_DESCRIPTION,
      inLanguage: 'ko-KR',
    },
    {
      '@type': 'Service',
      '@id': `${LANDING_URL}#service`,
      name: 'Parro EDU',
      serviceType: 'AI 기반 실습 가이드 제작 및 교육 운영',
      description: LANDING_DESCRIPTION,
      url: LANDING_URL,
      audience: {
        '@type': 'EducationalAudience',
        educationalRole: 'teacher, student',
      },
    },
  ],
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={eduSans.variable}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd) }}
      />
      {children}
    </div>
  );
}

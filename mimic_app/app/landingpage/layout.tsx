import type { Metadata } from 'next';
import { BRAND_NAME, getBrandAppUrl } from '@/lib/brand';
import { LANDING_FAQS } from '@/lib/landing-faq';

const APP_URL = getBrandAppUrl();
const LANDING_URL = `${APP_URL}/landingpage`;
const SEO_TITLE = 'AI 매뉴얼 자동 생성·라이브 가이드';
const SEO_DESCRIPTION = 'Parro는 화면을 평소처럼 조작하면 단계별 설명과 하이라이트가 포함된 업무 매뉴얼과 실습형 라이브 가이드를 자동으로 만듭니다.';

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  keywords: ['AI 매뉴얼', '업무 매뉴얼', '매뉴얼 자동 생성', '화면 녹화', 'SOP 자동화', '라이브 가이드', 'Parro'],
  alternates: {
    canonical: LANDING_URL,
  },
  openGraph: {
    title: `${SEO_TITLE} - ${BRAND_NAME}`,
    description: SEO_DESCRIPTION,
    url: LANDING_URL,
    type: 'website',
    locale: 'ko_KR',
    images: [
      {
        url: `${APP_URL}/api/og?title=${encodeURIComponent('30초 만에 인터랙티브 매뉴얼')}&sub=${encodeURIComponent('AI가 단계별 설명과 자막까지 자동 완성합니다')}`,
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} - ${SEO_TITLE}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SEO_TITLE} - ${BRAND_NAME}`,
    description: SEO_DESCRIPTION,
    images: [`${APP_URL}/api/og`],
  },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: LANDING_FAQS.map(faq => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.a,
    },
  })),
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}

import type { Metadata } from 'next';
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE, getBrandAppUrl } from '@/lib/brand';
import { LANDING_FAQS } from '@/lib/landing-faq';

const APP_URL = getBrandAppUrl();

export const metadata: Metadata = {
  title: BRAND_TAGLINE,
  description: BRAND_DESCRIPTION,
  openGraph: {
    title: `${BRAND_TAGLINE} - ${BRAND_NAME}`,
    description: BRAND_DESCRIPTION,
    url: `${APP_URL}/landingpage`,
    images: [
      {
        url: `${APP_URL}/api/og?title=${encodeURIComponent('30초 만에 인터랙티브 매뉴얼')}&sub=${encodeURIComponent('AI가 단계별 설명과 자막까지 자동 완성합니다')}`,
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
      },
    ],
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

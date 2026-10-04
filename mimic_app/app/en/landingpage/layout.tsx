import type { Metadata } from 'next';
import {
  BRAND_CANONICAL_URL,
  BRAND_NAME,
  isSearchIndexingEnabled,
} from '@/lib/brand';
import { LANDING_FAQS_EN } from '@/lib/landing-faq';

const APP_URL = BRAND_CANONICAL_URL;
const LANDING_URL = `${APP_URL}/en/landingpage`;
const LANDING_TITLE = 'AI Workflow Manuals and Live Guides';
const LANDING_DESCRIPTION = 'Record a workflow once, turn it into a step-by-step manual with AI, and guide people directly on the live screen with Parro.';
const SEARCH_INDEXING_ENABLED = isSearchIndexingEnabled();
const OG_IMAGE_URL = `${APP_URL}/api/og?title=${encodeURIComponent(LANDING_TITLE)}&sub=${encodeURIComponent('From one screen recording to a reusable manual and live guidance')}`;

export const metadata: Metadata = {
  title: LANDING_TITLE,
  description: LANDING_DESCRIPTION,
  keywords: [
    'AI workflow manual',
    'SOP generator',
    'screen recording documentation',
    'software onboarding',
    'interactive guide',
    'live guide',
    'Parro',
  ],
  alternates: {
    canonical: LANDING_URL,
    languages: {
      'ko-KR': `${APP_URL}/landingpage`,
      'en-US': LANDING_URL,
      'x-default': `${APP_URL}/landingpage`,
    },
  },
  robots: {
    index: SEARCH_INDEXING_ENABLED,
    follow: SEARCH_INDEXING_ENABLED,
  },
  openGraph: {
    title: `${LANDING_TITLE} | ${BRAND_NAME}`,
    description: LANDING_DESCRIPTION,
    url: LANDING_URL,
    type: 'website',
    siteName: BRAND_NAME,
    locale: 'en_US',
    alternateLocale: ['ko_KR'],
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: `${BRAND_NAME} | ${LANDING_TITLE}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${LANDING_TITLE} | ${BRAND_NAME}`,
    description: LANDING_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};

const landingJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${APP_URL}/#website-en`,
      url: LANDING_URL,
      name: BRAND_NAME,
      description: LANDING_DESCRIPTION,
      inLanguage: 'en-US',
      publisher: { '@id': `${APP_URL}/#organization` },
    },
    {
      '@type': 'Service',
      '@id': `${LANDING_URL}#service`,
      name: `${BRAND_NAME} AI Workflow Manuals and Live Guides`,
      serviceType: 'AI workflow documentation and on-screen live guidance',
      description: LANDING_DESCRIPTION,
      url: LANDING_URL,
      provider: { '@id': `${APP_URL}/#organization` },
      audience: {
        '@type': 'BusinessAudience',
        audienceType: 'Software training, onboarding, customer support, and operations teams',
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${LANDING_URL}#faq`,
      mainEntity: LANDING_FAQS_EN.map(faq => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: { '@type': 'Answer', text: faq.a },
      })),
    },
  ],
};

export default function EnglishLandingLayout({ children }: { children: React.ReactNode }) {
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

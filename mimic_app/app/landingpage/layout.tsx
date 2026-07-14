import type { Metadata } from 'next';
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE, getBrandAppUrl } from '@/lib/brand';

const APP_URL = getBrandAppUrl();

export const metadata: Metadata = {
  title: `${BRAND_TAGLINE} - ${BRAND_NAME}`,
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
  mainEntity: [
    {
      '@type': 'Question',
      name: '언제든 취소할 수 있나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '네, 마이페이지에서 언제든 구독을 해지할 수 있어요. 해지 후에도 결제한 기간까지는 모든 기능을 그대로 사용하실 수 있습니다.',
      },
    },
    {
      '@type': 'Question',
      name: '무료 플랜의 매뉴얼은 어떻게 보관되나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '무료 플랜에서 만든 매뉴얼은 영구 보관됩니다. 매일 만들 수 있는 개수만 3개로 제한되며, 기존에 만든 매뉴얼 열람·편집·공유는 평생 자유롭게 가능합니다.',
      },
    },
    {
      '@type': 'Question',
      name: '어떤 결제 방법을 지원하나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '국내·해외 주요 신용카드와 카카오페이, 토스페이를 지원합니다. 기업 결제는 세금계산서 발행이 가능합니다.',
      },
    },
    {
      '@type': 'Question',
      name: '플랜은 자유롭게 변경할 수 있나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '언제든 업그레이드·다운그레이드할 수 있어요. 업그레이드는 즉시 반영되고, 다운그레이드는 다음 결제 주기부터 적용됩니다.',
      },
    },
    {
      '@type': 'Question',
      name: '환불 정책은 어떻게 되나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '결제 후 7일 이내, 유료 기능을 한 번도 사용하지 않은 경우 전액 환불이 가능합니다.',
      },
    },
    {
      '@type': 'Question',
      name: '팀이나 회사 단위로 사용하려면 어떻게 하나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '팀 워크스페이스 기능이 곧 출시됩니다. 우선 사용을 원하시면 기업 데모 신청을 통해 베타 액세스를 받으실 수 있습니다.',
      },
    },
  ],
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

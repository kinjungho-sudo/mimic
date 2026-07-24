import type { MetadataRoute } from 'next';
import { BRAND_CANONICAL_URL, isSearchIndexingEnabled } from '@/lib/brand';

export default function robots(): MetadataRoute.Robots {
  if (!isSearchIndexingEnabled()) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/auth/',
          '/dashboard',
          '/desktop-import',
          '/desktop-setup',
          '/download/desktop',
          '/extension-link',
          '/forbidden',
          '/home',
          '/manual/',
          '/mypage',
          '/onboarding',
          '/settings',
          '/trash',
          '/workspace/',
        ],
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
    ],
    sitemap: `${BRAND_CANONICAL_URL}/sitemap.xml`,
    host: BRAND_CANONICAL_URL,
  };
}

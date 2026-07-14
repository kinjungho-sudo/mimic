import type { MetadataRoute } from 'next';
import { getBrandAppUrl } from '@/lib/brand';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: [
          'Googlebot',
          'Yeti',
          'Bingbot',
          'GPTBot',
          'ChatGPT-User',
          'PerplexityBot',
          'ClaudeBot',
          'Google-Extended',
          'Gemini',
        ],
        allow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/home', '/mypage', '/settings', '/trash'],
      },
    ],
    sitemap: `${getBrandAppUrl()}/sitemap.xml`,
  };
}

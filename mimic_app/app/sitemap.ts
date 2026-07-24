import type { MetadataRoute } from 'next';
import { BRAND_CANONICAL_URL } from '@/lib/brand';

const BASE_URL = BRAND_CANONICAL_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/landingpage`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}

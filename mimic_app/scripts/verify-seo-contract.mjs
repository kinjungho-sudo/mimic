import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  brand,
  nextConfig,
  rootLayout,
  rootPage,
  landingLayout,
  sitemap,
  robots,
  shareMetadata,
  privacyPage,
  termsPage,
  googleVerification,
  naverVerification,
] = await Promise.all([
  read('lib/brand.ts'),
  read('next.config.mjs'),
  read('app/layout.tsx'),
  read('app/page.tsx'),
  read('app/landingpage/layout.tsx'),
  read('app/sitemap.ts'),
  read('app/robots.ts'),
  read('lib/share-metadata.ts'),
  read('app/legal/privacy/page.tsx'),
  read('app/legal/terms/page.tsx'),
  read('public/googlefb86130838350dc0.html'),
  read('public/naver8075e3d1d1095097db53dfe6cc0fc6fc.html'),
]);

assert.match(brand, /BRAND_CANONICAL_URL = 'https:\/\/parro-guide\.vercel\.app'/);
assert.match(brand, /BRAND_APP_URL_FALLBACK = BRAND_CANONICAL_URL/);
assert.match(brand, /process\.env\.VERCEL_ENV === 'production'/);

assert.match(nextConfig, /source: '\/',[\s\S]*destination: '\/landingpage',[\s\S]*permanent: true/);
assert.match(rootPage, /permanentRedirect\('\/landingpage'\)/);
assert.match(rootLayout, /index: false,\s*follow: false/);
assert.match(rootLayout, /wzMjB4SCst9I9ECfPP4z9-5Z_zIGD1iI5nYow0LG1Qs/);
assert.match(rootLayout, /'naver-site-verification': '8075e3d1d1095097db53dfe6cc0fc6fc'/);
assert.match(rootLayout, /'msvalidate\.01'/);
assert.match(rootLayout, /"@type": "Organization"/);

assert.match(landingLayout, /LANDING_TITLE = 'AI 업무 매뉴얼 제작과 라이브 가이드'/);
assert.match(landingLayout, /canonical: LANDING_URL/);
assert.match(landingLayout, /'ko-KR': LANDING_URL/);
assert.match(landingLayout, /index: SEARCH_INDEXING_ENABLED/);
assert.match(landingLayout, /'max-image-preview': 'large'/);
assert.match(landingLayout, /'@type': 'WebSite'/);
assert.match(landingLayout, /'@type': 'Service'/);
assert.match(landingLayout, /'@type': 'FAQPage'/);

assert.match(sitemap, /\/landingpage/);
assert.match(sitemap, /\/legal\/privacy/);
assert.match(sitemap, /\/legal\/terms/);
assert.doesNotMatch(sitemap, /\/auth\//);
assert.doesNotMatch(sitemap, /lastModified:\s*new Date/);

assert.match(robots, /userAgent: '\*'/);
assert.match(robots, /'\/auth\/'/);
assert.match(robots, /'\/api\/'/);
assert.match(robots, /BRAND_CANONICAL_URL}\/sitemap\.xml/);
assert.doesNotMatch(robots, /userAgent:\s*\[[\s\S]*Googlebot/);

assert.match(shareMetadata, /isSearchIndexingEnabled\(\)/);
assert.match(privacyPage, /index: isSearchIndexingEnabled\(\)/);
assert.match(termsPage, /canonical: '\/legal\/terms'/);
assert.match(termsPage, /index: isSearchIndexingEnabled\(\)/);

assert.equal(
  googleVerification.trim(),
  'google-site-verification: googlefb86130838350dc0.html',
);
assert.equal(
  naverVerification.trim(),
  'naver-site-verification: naver8075e3d1d1095097db53dfe6cc0fc6fc.html',
);

console.log(JSON.stringify({ ok: true, checks: 39, scope: 'seo-search-discovery' }));

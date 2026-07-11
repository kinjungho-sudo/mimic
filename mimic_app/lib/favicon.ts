import { BRAND_BOT_USER_AGENT } from '@/lib/brand';

/**
 * 도메인 favicon URL 해석 유틸
 *
 * 우선순위:
 * 1. DB에 저장된 값 (크롬 확장이 직접 수집)
 * 2. Google Favicons API  (빠르고 광범위 — 대부분 커버)
 * 3. DuckDuckGo Icons API (Google이 안 될 때 fallback)
 * 4. 사이트 /favicon.ico 직접 요청 (서버사이드만)
 */

/** 클라이언트: DB 값 없으면 Google → DuckDuckGo 순 fallback URL 반환 */
export function faviconUrl(
  stored: string | null | undefined,
  hostname: string | null | undefined,
  size = 32
): string | null {
  if (stored) return stored;
  if (!hostname) return null;
  const clean = hostname.replace(/^www\./, '');
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=${size}`;
}

/** 클라이언트 onError 시 DuckDuckGo fallback URL */
export function faviconFallbackUrl(hostname: string | null | undefined): string | null {
  if (!hostname) return null;
  const clean = hostname.replace(/^www\./, '');
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(clean)}.ico`;
}

/**
 * 서버사이드: HTML 파싱으로 favicon URL 추출
 * Google/DuckDuckGo가 모두 실패하는 사이트(정부24 등) 대응
 */
export async function fetchFaviconFromHtml(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': `Mozilla/5.0 (compatible; ${BRAND_BOT_USER_AGENT})` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // <link rel="icon/shortcut icon/apple-touch-icon"> 순으로 탐색
    const patterns = [
      /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const href = match[1];
        if (href.startsWith('http')) return href;
        const base = new URL(pageUrl);
        return new URL(href, base.origin).toString();
      }
    }

    // fallback: /favicon.ico
    const base = new URL(pageUrl);
    return `${base.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

/**
 * hostname → 사람이 읽기 좋은 서비스명
 *
 * domain_name(페이지 타이틀)은 동적으로 바뀌어 신뢰할 수 없음.
 * hostname의 2단계 도메인명을 대문자로 변환해 표시명으로 사용.
 * 예: www.coupang.com → "Coupang"
 *     checkout.coupang.com → "Coupang"
 *     docs.google.com → "Google"
 *     fin.land.naver.com → "Naver"
 */
export function hostnameToServiceName(hostname: string | null | undefined): string | null {
  if (!hostname || hostname === 'null') return null;
  try {
    // TLD 앞 마지막 도메인 레벨 추출
    // fin.land.naver.com → parts = ['fin','land','naver','com'] → 'naver'
    const parts = hostname.replace(/^www\./, '').split('.');
    // co.kr, com.au 등 2단 TLD 처리
    const twoPartTLDs = new Set(['co.kr','co.uk','co.jp','com.au','co.nz','or.kr','go.kr','ne.jp']);
    const tail2 = parts.slice(-2).join('.');
    const nameIdx = twoPartTLDs.has(tail2) ? parts.length - 3 : parts.length - 2;
    const name = parts[Math.max(0, nameIdx)];
    // 첫 글자 대문자
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return hostname;
  }
}

/**
 * 서버사이드: Google → DuckDuckGo → HTML 파싱 순으로 시도
 * finalize에서 favicon null인 스텝 보완 시 사용
 */
export async function resolveFavicon(
  storedFavicon: string | null | undefined,
  hostname: string | null | undefined,
  pageUrl: string | null | undefined
): Promise<string | null> {
  // 1. DB 저장값 있으면 그대로
  if (storedFavicon) return storedFavicon;
  if (!hostname) return null;

  const clean = hostname.replace(/^www\./, '');

  // 2. Google Favicons API가 빈 1x1 gif를 반환하는지 확인하는 것은
  //    서버사이드에서 어렵고 느리므로, Google URL을 우선 저장
  //    (클라이언트에서 onError 시 DuckDuckGo로 자동 교체)
  const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=32`;

  // 3. 정부/공공 도메인이나 비영어권은 HTML 직접 파싱
  const isKoreanGov = /\.(go\.kr|gov\.kr|or\.kr|re\.kr|ac\.kr)$/i.test(hostname);
  const isProblemDomain = isKoreanGov || /claude\.ai|anthropic\.com/i.test(hostname);

  if (isProblemDomain && pageUrl) {
    try {
      const htmlFavicon = await fetchFaviconFromHtml(pageUrl);
      if (htmlFavicon) return htmlFavicon;
    } catch { /* ignore, fall through */ }
  }

  return googleUrl;
}

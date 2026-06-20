import Anthropic from '@anthropic-ai/sdk';
import { createServiceRoleClient } from '@/lib/supabase/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 두 스크린샷을 Claude Vision으로 비교해 유사도 점수 반환 (0~1)
async function compareScreenshots(
  savedBase64: string,
  currentBase64: string,
  savedType: string,
  currentType: string
): Promise<number> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
  type AllowedType = typeof allowed[number];
  const toAllowed = (t: string): AllowedType =>
    allowed.find(a => t.includes(a)) ?? 'image/jpeg';

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: toAllowed(savedType), data: savedBase64 } },
        { type: 'image', source: { type: 'base64', media_type: toAllowed(currentType), data: currentBase64 } },
        {
          type: 'text',
          text: `두 스크린샷을 비교해서 UI가 얼마나 비슷한지 0~1 사이 숫자만 반환해줘.
1.0 = 완전히 동일, 0.0 = 완전히 다름.
레이아웃·버튼 위치·메뉴 구조 기준으로 판단. 숫자만 응답.`,
        },
      ],
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '1';
  const score = parseFloat(text);
  return isNaN(score) ? 1 : Math.min(1, Math.max(0, score));
}

export async function checkStepFreshness(
  stepId: string,
  pageUrl: string,
  savedScreenshotUrl: string
): Promise<{ stepId: string; is_stale: boolean; similarity: number }> {
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  try {
    // 현재 페이지 스크린샷 캡처 (Vercel에서 실행 가능한 방법: URL의 OG 이미지 또는 screenshot 서비스)
    // 간단 버전: page URL에서 og:image 메타태그 추출
    const currentScreenshotUrl = await fetchOgImage(pageUrl);

    if (!currentScreenshotUrl) {
      // OG 이미지 없으면 체크 불가 — stale 아님으로 처리
      await supabase
        .from('mm_steps')
        .update({ freshness_checked_at: now, is_stale: false })
        .eq('id', stepId);
      return { stepId, is_stale: false, similarity: 1 };
    }

    // 두 이미지를 base64로 변환
    const [savedRes, currentRes] = await Promise.all([
      fetch(savedScreenshotUrl),            // 우리 Storage 공개 URL (신뢰)
      ssrfSafeFetch(currentScreenshotUrl),  // 외부 og:image (SSRF 방어)
    ]);

    if (!savedRes.ok || !currentRes.ok) {
      await supabase.from('mm_steps').update({ freshness_checked_at: now }).eq('id', stepId);
      return { stepId, is_stale: false, similarity: 1 };
    }

    const [savedBuf, currentBuf] = await Promise.all([
      savedRes.arrayBuffer(),
      currentRes.arrayBuffer(),
    ]);

    const savedBase64 = Buffer.from(savedBuf).toString('base64');
    const currentBase64 = Buffer.from(currentBuf).toString('base64');
    const savedType = savedRes.headers.get('content-type') ?? 'image/jpeg';
    const currentType = currentRes.headers.get('content-type') ?? 'image/jpeg';

    const similarity = await compareScreenshots(savedBase64, currentBase64, savedType, currentType);
    const is_stale = similarity < 0.7;

    await supabase
      .from('mm_steps')
      .update({ freshness_checked_at: now, is_stale })
      .eq('id', stepId);

    return { stepId, is_stale, similarity };
  } catch {
    // 실패 시 stale 아님으로 처리 (false negative가 false positive보다 낫다)
    await supabase.from('mm_steps').update({ freshness_checked_at: now, is_stale: false }).eq('id', stepId);
    return { stepId, is_stale: false, similarity: 1 };
  }
}

// 사설망/메타데이터 IP 차단 — SSRF 방지. 10진수·8진수·16진수 IP 인코딩, IPv6 루프백/링크로컬도 차단.
function isPrivateUrl(url: string): boolean {
  let host: string, protocol: string;
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    protocol = u.protocol;
  } catch {
    return true;
  }
  if (!['http:', 'https:'].includes(protocol)) return true;
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;

  if (host.includes(':')) { // IPv6
    if (host === '::1' || host === '::') return true;
    if (/^fe80:/i.test(host)) return true;             // link-local
    if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true; // unique local fc00::/7
    return false;
  }

  const octets = ipv4ToOctets(host); // 점표기/정수/16진수 인코딩 정규화
  if (octets) {
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;            // 링크로컬·클라우드 메타데이터(169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  return false; // DNS 이름 — resolve 불가, 잔여 위험은 ssrfSafeFetch 리다이렉트 재검증으로 보완
}

// "127.0.0.1" | "2130706433"(정수) | "0x7f000001"(16진수) | "127.1"(단축형) → 4옥텟. IP 아니면 null.
function ipv4ToOctets(h: string): [number, number, number, number] | null {
  const parts = h.split('.');
  const nums: number[] = [];
  for (const p of parts) {
    if (p === '') return null;
    let n: number;
    if (/^0x[0-9a-f]+$/i.test(p)) n = parseInt(p, 16);
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8);
    else if (/^\d+$/.test(p)) n = parseInt(p, 10);
    else return null;
    if (!Number.isFinite(n) || n < 0) return null;
    nums.push(n);
  }
  let val: number;
  if (nums.length === 1) val = nums[0];
  else if (nums.length === 2) val = nums[0] * 2 ** 24 + (nums[1] & 0xffffff);
  else if (nums.length === 3) val = nums[0] * 2 ** 24 + nums[1] * 2 ** 16 + (nums[2] & 0xffff);
  else if (nums.length === 4) { if (nums.some(n => n > 255)) return null; val = nums[0] * 2 ** 24 + nums[1] * 2 ** 16 + nums[2] * 2 ** 8 + nums[3]; }
  else return null;
  if (!Number.isFinite(val) || val < 0 || val > 0xffffffff) return null;
  return [(val >>> 24) & 255, (val >>> 16) & 255, (val >>> 8) & 255, val & 255];
}

// SSRF 안전 fetch — 매 홉마다 사설망 검증 후 수동 리다이렉트 추종 (자동 추종으로 내부 IP 우회 차단)
async function ssrfSafeFetch(url: string, init: RequestInit = {}, maxRedirects = 3): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (isPrivateUrl(current)) throw new Error('blocked: private url');
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('blocked: too many redirects');
}

// 페이지 URL에서 og:image 추출 (서버사이드 fetch)
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await ssrfSafeFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MIMICBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (!match) return null;
    const ogUrl = match[1];
    // 상대경로 처리
    const resolved = ogUrl.startsWith('http')
      ? ogUrl
      : new URL(ogUrl, new URL(url).origin).toString();
    // OG 이미지 URL도 사설망 차단
    if (isPrivateUrl(resolved)) return null;
    return resolved;
  } catch {
    return null;
  }
}

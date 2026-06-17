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
      fetch(savedScreenshotUrl),
      fetch(currentScreenshotUrl),
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

// 사설망 IP 범위 차단 — SSRF 방지
function isPrivateUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (!['http:', 'https:'].includes(protocol)) return true;
    if (/^(localhost|127\.|0\.0\.0\.0|::1$)/.test(hostname)) return true;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)) return true;
    return false;
  } catch {
    return true;
  }
}

// 페이지 URL에서 og:image 추출 (서버사이드 fetch)
async function fetchOgImage(url: string): Promise<string | null> {
  if (isPrivateUrl(url)) return null;
  try {
    const res = await fetch(url, {
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

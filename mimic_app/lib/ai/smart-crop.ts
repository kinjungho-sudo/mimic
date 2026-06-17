import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type CropRect = {
  x: number; // 0~1
  y: number;
  w: number;
  h: number;
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type AllowedType = typeof ALLOWED_TYPES[number];
function toAllowedType(ct: string): AllowedType {
  return ALLOWED_TYPES.find(t => ct.includes(t)) ?? 'image/jpeg';
}

/**
 * Claude Vision으로 클릭 좌표 주변 UI 요소의 경계를 감지해 크롭 영역(0~1) 반환.
 * 실패하면 클릭 좌표 중심의 기본 크롭 영역 반환.
 */
export async function detectCropRect(
  screenshotBase64: string,
  mediaType: string,
  clickX: number,   // 0~1 정규화
  clickY: number,
): Promise<CropRect> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: toAllowedType(mediaType),
              data: screenshotBase64,
            },
          },
          {
            type: 'text',
            text: `이 스크린샷에서 좌표 (${(clickX * 100).toFixed(1)}%, ${(clickY * 100).toFixed(1)}%) 위치에 있는 UI 요소(버튼, 입력창, 링크, 메뉴 등)의 경계 박스를 찾아줘.

규칙:
- 클릭한 요소와 그 직접적인 컨텍스트(부모 컨테이너)만 포함
- 전체 화면의 20~60% 범위가 적당함
- 너무 넓거나(70% 이상) 너무 좁으면(5% 이하) 기본값 사용
- 좌표는 0~1 정규화 (0=왼쪽/위, 1=오른쪽/아래)

JSON만 응답:
{"x":0.1,"y":0.2,"w":0.4,"h":0.3}`,
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(clean) as { x: number; y: number; w: number; h: number };

    const { x, y, w, h } = parsed;
    // 유효성 검사
    if (
      typeof x === 'number' && typeof y === 'number' &&
      typeof w === 'number' && typeof h === 'number' &&
      x >= 0 && y >= 0 && w > 0.05 && h > 0.05 &&
      x + w <= 1.1 && y + h <= 1.1 &&
      w <= 0.75 && h <= 0.85
    ) {
      return {
        x: Math.max(0, x),
        y: Math.max(0, y),
        w: Math.min(w, 1 - Math.max(0, x)),
        h: Math.min(h, 1 - Math.max(0, y)),
      };
    }
  } catch {
    // 파싱/API 실패 → fallback
  }

  // fallback: 클릭 좌표 중심 40%×40% 크롭
  return fallbackCrop(clickX, clickY);
}

function fallbackCrop(clickX: number, clickY: number): CropRect {
  const w = 0.5;
  const h = 0.45;
  const x = Math.max(0, Math.min(clickX - w / 2, 1 - w));
  const y = Math.max(0, Math.min(clickY - h / 2, 1 - h));
  return { x, y, w, h };
}

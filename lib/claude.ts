import Anthropic from '@anthropic-ai/sdk';
import type { Step } from '@/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function analyzeScreenshot(
  base64Image: string,
  pageUrl: string
): Promise<{ title: string; description: string }> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `이 스크린샷을 분석해서 사용자가 무엇을 클릭/입력했는지 설명해줘.
페이지 URL: ${pageUrl}

응답 형식 (JSON만, 마크다운 없이):
{
  "title": "15자 이내 짧은 제목",
  "description": "40자 이내 행동 설명"
}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(text.trim());
    return {
      title: String(parsed.title || '').slice(0, 15),
      description: String(parsed.description || '').slice(0, 40),
    };
  } catch {
    return { title: '스텝', description: '다음 단계를 진행하세요.' };
  }
}

export async function generateScript(
  steps: Step[],
  userDraft?: string
): Promise<{ script: string; markerPositions: number[] }> {
  const stepsText = steps
    .map(
      s =>
        `Step ${s.step_number}: ${s.user_title || s.ai_title || '제목 없음'}\n` +
        `설명: ${s.ai_description || ''}\n` +
        `URL: ${s.page_url || ''}`
    )
    .join('\n\n');

  const draftSection = userDraft ? `\n사용자 초안:\n${userDraft}` : '';

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `다음 매뉴얼 단계들을 보고 TTS용 한국어 스크립트를 작성해줘.

${stepsText}${draftSection}

규칙:
- 자연스럽고 친근한 한국어 (존댓말)
- 각 클릭 위치는 ①②③ 마커로 표시
- 전체 1분 이내
- JSON만 응답 (마크다운 없이):
{
  "script": "전체 스크립트 텍스트",
  "markerPositions": [마커①이 나오는 ms 위치, 마커②..., ...]
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(text.trim());
    return {
      script: String(parsed.script || ''),
      markerPositions: Array.isArray(parsed.markerPositions) ? parsed.markerPositions : [],
    };
  } catch {
    return { script: '', markerPositions: [] };
  }
}

export async function generateMarkers(steps: Step[]) {
  const stepsData = steps.map(s => ({
    id: s.id,
    title: s.user_title || s.ai_title,
    description: s.ai_description,
    page_url: s.page_url,
    screenshot_url: s.screenshot_url,
  }));

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `다음 매뉴얼 데이터를 보고 ①②③ 마커를 자동으로 배치해줘.

스텝 목록:
${JSON.stringify(stepsData, null, 2)}

규칙:
- 모든 클릭 위치 = 마커 후보
- 너무 가까운 클릭은 하나로 묶기
- 사용자 시선 흐름 자연스럽게 (좌→우, 위→아래)
- 마커 번호는 시간 순서대로
- position_x, position_y 는 0~1 정규화

응답 형식 (JSON만):
{
  "markers": [
    {
      "step_id": "uuid",
      "marker_number": 1,
      "position_x": 0.18,
      "position_y": 0.38,
      "connected_effects": ["click_sound"]
    }
  ]
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(text.trim());
    return Array.isArray(parsed.markers) ? parsed.markers : [];
  } catch {
    return [];
  }
}

export async function generateDraft(
  steps: Array<{ id: string; ai_title: string | null; ai_description: string | null; page_url: string | null; step_number: number }>
): Promise<{ steps: Array<{ id: string; user_title: string; user_script: string }>; tutorial_title: string }> {
  const stepsText = steps
    .map(s =>
      `[Step ${s.step_number}] id=${s.id}\n` +
      `제목: ${s.ai_title || '없음'}\n` +
      `설명: ${s.ai_description || '없음'}\n` +
      `URL: ${s.page_url || '없음'}`
    )
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `다음은 사용자가 녹화한 매뉴얼 단계들입니다. 각 단계에 대해 더 풍부하고 자연스러운 한국어 매뉴얼 초안을 작성해줘.

${stepsText}

규칙:
- tutorial_title: 이 매뉴얼 전체를 대표하는 30자 이내 제목 (예: "Slack 채널 만들기", "구글 드라이브 파일 공유 방법")
- user_title: 각 단계를 20자 이내의 명확한 행동 제목으로 (예: "로그인 버튼 클릭", "이메일 주소 입력")
- user_script: 각 단계를 독자가 따라하기 쉽게 2-3문장으로 설명 (존댓말, 구체적인 행동 묘사)
- 모든 step id를 포함해야 함

응답 형식 (JSON만, 마크다운 없이):
{
  "tutorial_title": "...",
  "steps": [
    { "id": "uuid", "user_title": "...", "user_script": "..." }
  ]
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(text.trim());
    return {
      tutorial_title: String(parsed.tutorial_title || ''),
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    };
  } catch {
    return { tutorial_title: '', steps: [] };
  }
}

// 스크린샷에서 dominant color 2개를 추출해 커버 그라데이션 색상 반환
export async function extractCoverColors(
  screenshotBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
): Promise<{ color1: string; color2: string }> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: screenshotBase64 },
          },
          {
            type: 'text',
            text: `이 스크린샷의 전체적인 색감과 분위기를 참고해서, 매뉴얼 커버로 어울리는 그라데이션 색상 2개를 골라줘. 너무 밝거나 너무 어둡지 않게, 브랜드 컬러처럼 세련되게.
JSON만 응답 (마크다운 없이):
{"color1":"#hex","color2":"#hex"}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(text.trim());
    const hexRe = /^#[0-9a-fA-F]{6}$/;
    if (hexRe.test(parsed.color1) && hexRe.test(parsed.color2)) {
      return { color1: parsed.color1, color2: parsed.color2 };
    }
  } catch { /* fallback */ }
  return { color1: '#4F46E5', color2: '#7C3AED' };
}

export async function rewriteSentence(
  original: string,
  instruction: string
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `다음 문장을 "${instruction}" 방식으로 다시 작성해줘. 수정된 문장만 반환하고, 설명이나 따옴표는 붙이지 마.

원문:
${original}`,
    }],
  });
  return response.content[0].type === 'text' ? response.content[0].text.trim() : original;
}

export async function generateAnnotations(userPrompt: string, stepContext: string) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `사용자 요청: ${userPrompt}

스텝 컨텍스트: ${stepContext}

위 요청에 맞게 시각적 주석(annotation)을 생성해줘.

응답 형식 (JSON만):
{
  "annotations": [
    {
      "type": "text" | "arrow" | "rectangle" | "circle" | "underline",
      "style": { "color": "#F59E0B", "opacity": 1 },
      "geometry": { "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.1 },
      "show_duration_ms": 3000
    }
  ]
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const parsed = JSON.parse(text.trim());
    return Array.isArray(parsed.annotations) ? parsed.annotations : [];
  } catch {
    return [];
  }
}

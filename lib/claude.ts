import Anthropic from '@anthropic-ai/sdk';
import type { Step } from '@/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function analyzeScreenshot(
  base64Image: string,
  pageUrl: string
): Promise<{ title: string; description: string }> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
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
    model: 'claude-sonnet-4-6',
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
    model: 'claude-sonnet-4-6',
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

export async function generateAnnotations(userPrompt: string, stepContext: string) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
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

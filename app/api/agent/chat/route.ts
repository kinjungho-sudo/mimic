import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── 모드 타입 ──────────────────────────────────────────────

export type ChatMode = 'inquiry' | 'guide' | 'automation';

// ── 모드별 시스템 프롬프트 ─────────────────────────────────

const SYSTEM_PROMPTS: Record<ChatMode, string> = {
  inquiry: `당신은 MIMIC 서비스의 고객 지원 챗봇입니다. 고객의 문의를 친절하고 정확하게 답변하세요.

MIMIC 서비스 소개:
- 업무 화면을 녹화해 인터랙티브 매뉴얼을 자동 생성하는 SaaS
- Chrome 확장 프로그램으로 클릭 동작을 캡처
- Guide Me 기능: 실제 페이지 위에 오버레이로 단계별 안내
- 플랜: 무료(일 3회 생성), Pro(무제한), Team(협업)

답변 규칙:
- 한국어로 친근하고 정중하게 답변하세요
- 모르는 내용은 솔직히 모른다고 하고 공식 채널을 안내하세요
- 기술 문의는 구체적인 해결 방법을 제시하세요
- 3문장 이내로 간결하게 답변하세요`,

  guide: `당신은 MIMIC의 Guide Me 도우미입니다. 사용자가 매뉴얼을 따라 업무를 수행할 때 단계별로 안내합니다.

역할:
- 매뉴얼을 검색하고 단계를 파악한 뒤 Guide Me 오버레이를 시작해주세요
- 사용자가 막히거나 어디를 눌러야 하는지 물으면 해당 단계를 구체적으로 설명하세요
- "어디 있어요?", "무슨 버튼이에요?" 같은 질문에는 위치와 생김새를 설명하세요
- Guide Me를 시작하면 오버레이가 자동으로 각 단계를 하이라이트합니다

답변 규칙:
- 한국어로 친근하게 답변하세요
- 위치 설명 시 "화면 왼쪽 상단", "파란색 버튼" 등 직관적으로 표현하세요
- 매뉴얼을 찾으면 단계 수와 첫 번째 단계를 먼저 알려주세요
- 짧고 명확하게 답변하세요 (3문장 이내)`,

  automation: `당신은 MIMIC의 AI 자동화 워크플로우 어시스턴트입니다. (현재 BETA — 일부 기능만 지원)

지원 가능한 작업:
- 매뉴얼 검색 및 단계 확인
- Guide Me 오버레이 시작 (사용자가 직접 클릭)

현재 미지원:
- 브라우저 자동 클릭/입력 (로컬 Claude Code + Playwright 환경 필요)

안내 규칙:
- 자동화 요청 시 현재 지원 범위를 먼저 설명하세요
- Guide Me로 대신할 수 있는 작업은 Guide Me를 제안하세요
- 완전 자동화는 "Claude Code + Playwright 환경에서만 가능하다"고 안내하세요
- 한국어로 친근하게 답변하세요 (3문장 이내)`,
};

// ── 모드별 도구 세트 ───────────────────────────────────────

const TOOLS_GUIDE: Anthropic.Tool[] = [
  {
    name: 'search_tutorial',
    description: '매뉴얼 이름으로 MIMIC에서 검색합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: '검색어 (예: "네이버 메일", "쿠팡 주문")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_tutorial_steps',
    description: '매뉴얼의 전체 단계 목록을 가져옵니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tutorial_id: { type: 'string', description: '매뉴얼 ID' },
      },
      required: ['tutorial_id'],
    },
  },
  {
    name: 'open_guide_me',
    description: 'Guide Me 오버레이를 시작할 URL을 생성합니다. 버튼을 클릭하면 새 탭에서 Guide Me가 자동 시작됩니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tutorial_id: { type: 'string', description: '실행할 매뉴얼 ID' },
        start_step: { type: 'number', description: '시작할 스텝 번호 (기본값: 1)' },
      },
      required: ['tutorial_id'],
    },
  },
];

const TOOLS_BY_MODE: Record<ChatMode, Anthropic.Tool[]> = {
  inquiry: [],           // 문의 챗봇은 도구 불필요
  guide: TOOLS_GUIDE,    // Guide Me 전체 도구 사용
  automation: TOOLS_GUIDE, // 자동화도 Guide Me 도구 사용 (완전 자동화는 미구현)
};

// ── 도구 실행 ──────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string
): Promise<string> {
  const supabase = createServiceRoleClient();

  if (name === 'search_tutorial') {
    const { data } = await supabase
      .from('mm_tutorials')
      .select('id, title, status, created_at')
      .eq('user_id', userId)
      .ilike('title', `%${input.query}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data?.length) return '매뉴얼을 찾지 못했습니다.';
    return JSON.stringify(data.map(t => ({ id: t.id, title: t.title, status: t.status })));
  }

  if (name === 'get_tutorial_steps') {
    const { data: tut } = await supabase
      .from('mm_tutorials')
      .select('id')
      .eq('id', input.tutorial_id as string)
      .eq('user_id', userId)
      .single();

    if (!tut) return '매뉴얼 접근 권한이 없습니다.';

    const { data } = await supabase
      .from('mm_steps')
      .select('step_number, user_title, ai_title, user_script, ai_description, page_url, element_selector')
      .eq('tutorial_id', input.tutorial_id as string)
      .order('step_number', { ascending: true });

    return JSON.stringify((data ?? []).map(s => ({
      step: s.step_number,
      title: s.user_title ?? s.ai_title,
      description: s.user_script ?? s.ai_description,
      page_url: s.page_url,
      has_selector: !!s.element_selector,
    })));
  }

  if (name === 'open_guide_me') {
    const { data: tut } = await supabase
      .from('mm_tutorials')
      .select('id, share_token, status')
      .eq('id', input.tutorial_id as string)
      .eq('user_id', userId)
      .single();

    if (!tut) return '매뉴얼 접근 권한이 없습니다.';

    let token = tut.share_token;
    if (!token) {
      const newToken = Math.random().toString(36).slice(2, 14);
      await supabase
        .from('mm_tutorials')
        .update({ share_token: newToken, status: 'published' })
        .eq('id', tut.id);
      token = newToken;
    }

    const { data: firstStep } = await supabase
      .from('mm_steps')
      .select('page_url')
      .eq('tutorial_id', tut.id)
      .order('step_number', { ascending: true })
      .limit(1)
      .single();

    const pageUrl = firstStep?.page_url ?? 'about:blank';
    const startStep = (input.start_step as number | undefined) ?? 1;
    const sep = pageUrl.includes('?') ? '&' : '?';
    const guideUrl = `${pageUrl}${sep}mimic_guide=${token}${startStep > 1 ? `&mimic_step=${startStep - 1}` : ''}`;

    return JSON.stringify({ guide_url: guideUrl, page_url: pageUrl, token, start_step: startStep });
  }

  return '알 수 없는 도구입니다.';
}

// ── Route Handler ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: { messages?: Anthropic.MessageParam[]; mode?: ChatMode };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const messages: Anthropic.MessageParam[] = body.messages ?? [];
  const mode: ChatMode = body.mode ?? 'guide';

  if (!messages.length) return NextResponse.json({ error: 'messages required' }, { status: 400 });

  const encoder = new TextEncoder();
  const systemPrompt = SYSTEM_PROMPTS[mode];
  const tools = TOOLS_BY_MODE[mode];

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        const currentMessages = [...messages];

        for (let turn = 0; turn < 10; turn++) {
          const createParams: Anthropic.MessageCreateParamsNonStreaming = {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: systemPrompt,
            messages: currentMessages,
          };

          // 도구가 있을 때만 tools 포함 (inquiry 모드는 도구 없음)
          if (tools.length > 0) createParams.tools = tools;

          const response = await client.messages.create(createParams);

          for (const block of response.content) {
            if (block.type === 'text' && block.text) {
              send(JSON.stringify({ type: 'text', text: block.text }));
            }
          }

          if (response.stop_reason !== 'tool_use') break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type !== 'tool_use') continue;

            send(JSON.stringify({ type: 'tool_start', tool: block.name }));

            const result = await executeTool(
              block.name,
              block.input as Record<string, unknown>,
              auth.userId
            );

            if (block.name === 'open_guide_me') {
              try {
                const parsed = JSON.parse(result);
                send(JSON.stringify({ type: 'guide_me', ...parsed }));
              } catch { /* 파싱 실패 시 무시 */ }
            }

            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
          }

          currentMessages.push({ role: 'assistant', content: response.content });
          currentMessages.push({ role: 'user', content: toolResults });
        }
      } catch (err) {
        send(JSON.stringify({ type: 'error', message: String(err) }));
      } finally {
        send(JSON.stringify({ type: 'done' }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

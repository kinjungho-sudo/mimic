import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── 도구 정의 ──────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_tutorial',
    description: '매뉴얼 이름으로 MIMIC에서 검색합니다. 사용자가 실행하려는 업무와 관련된 매뉴얼을 찾을 때 사용하세요.',
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
    description: '매뉴얼의 전체 단계 목록을 가져옵니다. 매뉴얼을 찾은 후 내용을 파악할 때 사용하세요.',
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
    description: 'Guide Me 오버레이를 시작할 URL을 생성합니다. 매뉴얼을 찾고 사용자가 실행을 원할 때 호출하세요. 반환된 guide_url을 사용자에게 제공하면 새 탭에서 Guide Me가 자동 시작됩니다.',
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

    // 미발행 매뉴얼은 share_token이 없을 수 있음 — 임시 발행
    let token = tut.share_token;
    if (!token) {
      const newToken = Math.random().toString(36).slice(2, 14);
      await supabase
        .from('mm_tutorials')
        .update({ share_token: newToken, status: 'published' })
        .eq('id', tut.id);
      token = newToken;
    }

    // 첫 스텝의 page_url 가져오기
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

  let body: { messages?: Anthropic.MessageParam[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const messages: Anthropic.MessageParam[] = body.messages ?? [];
  if (!messages.length) return NextResponse.json({ error: 'messages required' }, { status: 400 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        // 에이전트 루프 — 도구 호출이 끝날 때까지 반복
        const currentMessages = [...messages];

        for (let turn = 0; turn < 10; turn++) {
          const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: `당신은 MIMIC의 AI 어시스턴트입니다. 사용자가 업무 매뉴얼을 찾고 실행하도록 도와주세요.

규칙:
- 한국어로 친근하게 답변하세요
- 매뉴얼을 찾으면 간략히 단계 수와 내용을 알려주세요
- Guide Me를 시작할 때는 open_guide_me 도구를 호출하세요
- 사용자가 막혔다고 하면 해당 단계를 구체적으로 설명해주세요
- 짧고 명확하게 답변하세요 (3문장 이내)`,
            messages: currentMessages,
            tools: TOOLS,
          });

          // 텍스트 블록 스트리밍
          for (const block of response.content) {
            if (block.type === 'text' && block.text) {
              send(JSON.stringify({ type: 'text', text: block.text }));
            }
          }

          // 도구 호출 없으면 종료
          if (response.stop_reason !== 'tool_use') break;

          // 도구 실행
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type !== 'tool_use') continue;

            send(JSON.stringify({ type: 'tool_start', tool: block.name }));

            const result = await executeTool(
              block.name,
              block.input as Record<string, unknown>,
              auth.userId
            );

            // open_guide_me 결과는 클라이언트에 직접 전달
            if (block.name === 'open_guide_me') {
              try {
                const parsed = JSON.parse(result);
                send(JSON.stringify({ type: 'guide_me', ...parsed }));
              } catch { /* 파싱 실패 시 무시 */ }
            }

            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
          }

          // 다음 턴 메시지 구성
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

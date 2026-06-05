import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '@/lib/auth-guard';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `당신은 MIMIC 서비스의 고객 지원 및 기능 안내 챗봇입니다.

MIMIC 서비스 소개:
- Chrome 확장 프로그램으로 업무 화면을 녹화해 인터랙티브 매뉴얼을 자동 생성하는 SaaS
- 클릭 동작을 캡처해 각 단계별 스크린샷 + 설명이 자동 생성됨
- Guide Me 기능: 실제 웹페이지 위에 오버레이로 단계별 안내 (sdk.js 삽입 방식)
- 플랜: 무료(일 3회 생성), Pro(무제한 생성), Team(워크스페이스 협업)
- PDF/PPTX 내보내기, 공유 링크, 비밀번호 보호 기능 지원
- 매뉴얼 최신성 검사: 원본 페이지 UI 변경 시 알림

주요 사용 사례:
- 신규 직원 온보딩 매뉴얼 제작
- 고객 지원용 서비스 이용 가이드
- 반복 업무 프로세스 문서화

답변 규칙:
- 한국어로 친근하고 정중하게 답변하세요
- MIMIC 기능에 대해 구체적으로 설명하세요
- 모르는 내용은 솔직히 모른다고 하고 이메일(support@mimic.so)을 안내하세요
- 3문장 이내로 간결하게 답변하세요`;

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
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages,
        });

        for (const block of response.content) {
          if (block.type === 'text' && block.text) {
            send(JSON.stringify({ type: 'text', text: block.text }));
          }
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

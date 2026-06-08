import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { base64Image, url, actionInfo } = await req.json();

    if (!base64Image || !url) {
      return new Response(JSON.stringify({ error: 'base64Image and url are required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    let domain = '';
    try { domain = new URL(url).hostname; } catch { domain = url; }

    // 행동 힌트 문자열 생성
    let actionHint = '';
    if (actionInfo) {
      const { type, label, tag, href, text } = actionInfo as Record<string, string>;
      if (type === 'type' && text) {
        actionHint = `\n사용자가 입력한 내용: "${text}"`;
      } else if (type === 'navigate' && label) {
        actionHint = `\n사용자가 "${label}" 링크를 클릭했습니다${href ? ` (목적지: ${href})` : ''}.`;
      } else if (type === 'toggle' && label) {
        actionHint = `\n사용자가 "${label}" 체크박스/라디오를 선택했습니다.`;
      } else if (type === 'select' && label) {
        actionHint = `\n사용자가 드롭다운에서 "${label}"을 선택했습니다.`;
      } else if (type === 'focus_input' && label) {
        actionHint = `\n사용자가 "${label}" 입력 필드를 클릭했습니다.`;
      } else if (label) {
        actionHint = `\n사용자가 "${label}" 버튼/요소를 클릭했습니다.`;
      }
    }

    // 행동 유형에 맞는 제목 형식 가이드
    const titleGuide = (() => {
      const type = actionInfo?.type;
      if (type === 'type') return '"(숫자) [입력 내용] 입력" 형식';
      if (type === 'navigate') return '"(숫자) [목적지] 이동" 형식';
      if (type === 'toggle') return '"(숫자) [항목] 선택/해제" 형식';
      if (type === 'select') return '"(숫자) [항목] 선택" 형식';
      return '"(숫자) [대상] 클릭" 형식';
    })();

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
            },
            {
              type: 'text',
              text: `이 스크린샷은 사용자가 "${domain}" 페이지에서 수행한 액션입니다.${actionHint}

스크린샷과 위 행동 정보를 바탕으로 아래 JSON만 반환하세요. 다른 텍스트 없이.
title은 ${titleGuide}으로 작성하세요. (예: "로그인 버튼 클릭", "이메일 주소 입력", "다음 페이지 이동")
{
  "title": "짧은 액션 제목 (20자 이내, 한국어, 행동 동사 포함)",
  "description": "AI가 이 액션을 재현할 수 있도록 구체적 설명 (60자 이내, 한국어)"
}`,
            },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '{}';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Claude returned no JSON');

    const result = JSON.parse(match[0]);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, title: null, description: null }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

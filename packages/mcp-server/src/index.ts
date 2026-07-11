import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// ── 환경변수 검증 ─────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_USER_ID = process.env.OWNER_USER_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OWNER_USER_ID) {
  console.error('필수 환경변수 누락: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_USER_ID');
  process.exit(1);
}

// ── Supabase ──────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── MCP Server ────────────────────────────────────────────
const server = new McpServer({
  name: 'mimic',
  version: '0.1.0',
});

// ── Tools ─────────────────────────────────────────────────

server.tool(
  'list_tutorials',
  'Parro에 저장된 매뉴얼 목록을 반환합니다. 실행할 워크플로우를 찾을 때 사용하세요.',
  {
    query: z.string().optional().describe('검색어 (선택). 매뉴얼 제목에서 필터링합니다.'),
    limit: z.number().int().min(1).max(50).optional().default(20).describe('최대 반환 개수'),
  },
  async ({ query, limit }) => {
    let q = supabase
      .from('mm_tutorials')
      .select('id, title, status, created_at')
      .eq('user_id', OWNER_USER_ID)
      .order('created_at', { ascending: false })
      .limit(limit ?? 20);

    if (query) q = q.ilike('title', `%${query}%`);

    const { data, error } = await q;
    if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }] };

    return {
      content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }],
    };
  }
);

server.tool(
  'get_steps',
  '매뉴얼의 전체 단계 목록을 반환합니다. 실행 전 전체 흐름을 파악할 때 사용하세요.',
  {
    tutorial_id: z.string().uuid().describe('매뉴얼 ID (list_tutorials로 얻은 id)'),
  },
  async ({ tutorial_id }) => {
    const { data: tut } = await supabase
      .from('mm_tutorials')
      .select('id')
      .eq('id', tutorial_id)
      .eq('user_id', OWNER_USER_ID)
      .single();

    if (!tut) return { content: [{ type: 'text', text: '매뉴얼을 찾을 수 없거나 접근 권한이 없습니다.' }] };

    const { data, error } = await supabase
      .from('mm_steps')
      .select('id, step_number, user_title, ai_title, page_url, element_selector, click_x, click_y')
      .eq('tutorial_id', tutorial_id)
      .order('step_number', { ascending: true });

    if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }] };

    const steps = (data ?? []).map(s => ({
      id: s.id,
      step_number: s.step_number,
      title: s.user_title ?? s.ai_title ?? `Step ${s.step_number}`,
      page_url: s.page_url,
      element_selector: s.element_selector,
      click_x: s.click_x != null ? s.click_x / 10000 : null,
      click_y: s.click_y != null ? s.click_y / 10000 : null,
    }));

    return {
      content: [{ type: 'text', text: JSON.stringify(steps, null, 2) }],
    };
  }
);

server.tool(
  'get_step_detail',
  '특정 단계의 상세 실행 정보를 반환합니다. element_selector, 좌표, 스크린샷 URL 등을 포함합니다.',
  {
    step_id: z.string().uuid().describe('Step ID (get_steps로 얻은 id)'),
  },
  async ({ step_id }) => {
    const { data, error } = await supabase
      .from('mm_steps')
      .select('id, step_number, user_title, ai_title, user_script, ai_description, page_url, element_selector, element_xpath, element_rect, click_x, click_y, screenshot_url, mm_tutorials!inner(user_id)')
      .eq('id', step_id)
      .eq('mm_tutorials.user_id', OWNER_USER_ID)
      .single();

    if (error || !data) return { content: [{ type: 'text', text: 'Step을 찾을 수 없거나 접근 권한이 없습니다.' }] };

    const detail = {
      id: data.id,
      step_number: data.step_number,
      title: data.user_title ?? data.ai_title,
      instruction: data.user_script ?? data.ai_description,
      page_url: data.page_url,
      element_selector: data.element_selector,
      element_xpath: data.element_xpath,
      element_rect: data.element_rect,
      click_x: data.click_x != null ? data.click_x / 10000 : null,
      click_y: data.click_y != null ? data.click_y / 10000 : null,
      screenshot_url: data.screenshot_url,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }],
    };
  }
);

// ── Auto-Run Tools ────────────────────────────────────────

server.tool(
  'start_execution',
  '매뉴얼 자동 실행 세션을 시작합니다. 실행 전 pre-flight 정보(실행 가능 스텝 수, 위험 스텝)를 반환합니다.',
  {
    tutorial_id: z.string().uuid().describe('실행할 매뉴얼 ID'),
  },
  async ({ tutorial_id }) => {
    const { data: tut } = await supabase
      .from('mm_tutorials')
      .select('id, title')
      .eq('id', tutorial_id)
      .eq('user_id', OWNER_USER_ID)
      .single();

    if (!tut) return { content: [{ type: 'text', text: '매뉴얼을 찾을 수 없거나 접근 권한이 없습니다.' }] };

    const { data: steps } = await supabase
      .from('mm_steps')
      .select('id, step_number, user_title, ai_title, page_url, element_selector, click_x, click_y')
      .eq('tutorial_id', tutorial_id)
      .order('step_number', { ascending: true });

    const total = steps?.length ?? 0;
    const runnable = steps?.filter(s => s.page_url && (s.element_selector || s.click_x)).length ?? 0;

    // 위험 키워드 감지
    const RISK_KEYWORDS = ['삭제', '제거', '결제', '주문', '구매', '탈퇴', '초기화', 'delete', 'remove', 'pay', 'checkout', 'purchase'];
    const riskySteps = (steps ?? []).filter(s => {
      const title = (s.user_title ?? s.ai_title ?? '').toLowerCase();
      return RISK_KEYWORDS.some(k => title.includes(k));
    }).map(s => ({ step_number: s.step_number, title: s.user_title ?? s.ai_title }));

    const { data: session } = await supabase
      .from('mm_execution_sessions')
      .insert({
        tutorial_id,
        user_id: OWNER_USER_ID,
        status: 'running',
        total_steps: total,
      })
      .select('id')
      .single();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          execution_session_id: session?.id,
          tutorial_title: tut.title,
          pre_flight: { total, runnable, risky_steps: riskySteps },
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'save_step_result',
  '스텝 실행 결과를 저장합니다. 각 스텝 실행 후 반드시 호출하세요.',
  {
    execution_session_id: z.string().uuid().describe('start_execution으로 얻은 세션 ID'),
    step_id: z.string().uuid().describe('실행한 스텝 ID'),
    step_number: z.number().int().describe('스텝 번호'),
    status: z.enum(['success', 'failed', 'skipped']).describe('실행 결과'),
    selector_used: z.string().optional().describe('실제 성공한 선택자 (selector/xpath/coordinate)'),
    error_message: z.string().optional().describe('실패 시 오류 메시지'),
  },
  async ({ execution_session_id, step_id, step_number, status, selector_used, error_message }) => {
    await supabase.from('mm_step_results').insert({
      execution_session_id,
      step_id,
      step_number,
      status,
      selector_used: selector_used ?? null,
      error_message: error_message ?? null,
    });

    if (status === 'success') {
      await supabase.rpc('increment_execution_completed', { session_id: execution_session_id });
    }

    return { content: [{ type: 'text', text: JSON.stringify({ saved: true, step_number, status }) }] };
  }
);

server.tool(
  'finish_execution',
  '매뉴얼 자동 실행 세션을 종료합니다. 모든 스텝 실행 후 반드시 호출하세요.',
  {
    execution_session_id: z.string().uuid().describe('종료할 세션 ID'),
    status: z.enum(['completed', 'failed', 'paused']).describe('최종 상태'),
  },
  async ({ execution_session_id, status }) => {
    await supabase
      .from('mm_execution_sessions')
      .update({ status, finished_at: new Date().toISOString() })
      .eq('id', execution_session_id)
      .eq('user_id', OWNER_USER_ID);

    return { content: [{ type: 'text', text: JSON.stringify({ finished: true, status }) }] };
  }
);

// ── Start ─────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);

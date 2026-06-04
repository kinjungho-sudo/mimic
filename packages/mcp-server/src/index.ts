import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// ── Supabase ──────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── MCP Server ────────────────────────────────────────────
const server = new McpServer({
  name: 'mimic',
  version: '0.1.0',
});

// ── Tools ─────────────────────────────────────────────────

/**
 * 매뉴얼 목록 조회
 * Claude가 "어떤 매뉴얼이 있어?" 물어볼 때 사용
 */
server.tool(
  'list_tutorials',
  'MIMIC에 저장된 매뉴얼 목록을 반환합니다. 실행할 워크플로우를 찾을 때 사용하세요.',
  {
    query: z.string().optional().describe('검색어 (선택). 매뉴얼 제목에서 필터링합니다.'),
    limit: z.number().int().min(1).max(50).optional().default(20).describe('최대 반환 개수'),
  },
  async ({ query, limit }) => {
    let q = supabase
      .from('mm_tutorials')
      .select('id, title, status, created_at, step_count:mm_steps(count)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit ?? 20);

    if (query) q = q.ilike('title', `%${query}%`);

    const { data, error } = await q;
    if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }] };

    const list = (data ?? []).map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      created_at: t.created_at,
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(list, null, 2),
      }],
    };
  }
);

/**
 * 특정 매뉴얼의 step 목록 조회
 * Claude가 실행 계획을 세울 때 사용
 */
server.tool(
  'get_steps',
  '매뉴얼의 전체 단계 목록을 반환합니다. 실행 전 전체 흐름을 파악할 때 사용하세요.',
  {
    tutorial_id: z.string().uuid().describe('매뉴얼 ID (list_tutorials로 얻은 id)'),
  },
  async ({ tutorial_id }) => {
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
      // click_x/y: DB 0~10000 → 0~1 정규화
      click_x: s.click_x != null ? s.click_x / 10000 : null,
      click_y: s.click_y != null ? s.click_y / 10000 : null,
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(steps, null, 2),
      }],
    };
  }
);

/**
 * 특정 step의 상세 정보 조회
 * Claude가 단계별로 실행할 때 사용
 */
server.tool(
  'get_step_detail',
  '특정 단계의 상세 실행 정보를 반환합니다. element_selector, 좌표, 스크린샷 URL 등을 포함합니다.',
  {
    step_id: z.string().uuid().describe('Step ID (get_steps로 얻은 id)'),
  },
  async ({ step_id }) => {
    const { data, error } = await supabase
      .from('mm_steps')
      .select('id, step_number, user_title, ai_title, user_script, ai_description, page_url, element_selector, element_xpath, element_rect, click_x, click_y, screenshot_url')
      .eq('id', step_id)
      .single();

    if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }] };

    const detail = {
      id: data.id,
      step_number: data.step_number,
      title: data.user_title ?? data.ai_title,
      instruction: data.user_script ?? data.ai_description,
      page_url: data.page_url,
      // 실행 데이터 — 선택자 우선, 좌표 fallback
      element_selector: data.element_selector,
      element_xpath: data.element_xpath,
      element_rect: data.element_rect,
      click_x: data.click_x != null ? data.click_x / 10000 : null,
      click_y: data.click_y != null ? data.click_y / 10000 : null,
      screenshot_url: data.screenshot_url,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(detail, null, 2),
      }],
    };
  }
);

// ── Start ─────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);

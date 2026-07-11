# Parro MCP Server

Parro 매뉴얼을 Claude 에이전트가 읽고 실행할 수 있도록 노출하는 MCP 서버.

## 설치 및 실행

```bash
cd packages/mcp-server
npm install
npm run build
```

## 환경변수

`.env` 파일 생성:

```
SUPABASE_URL=https://gqynptpjomcqzxyykqic.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

## Claude Code 등록

`~/.claude/claude_desktop_config.json` 또는 프로젝트 `.claude/settings.json`에 추가:

```json
{
  "mcpServers": {
    "mimic": {
      "command": "node",
      "args": ["<절대경로>/packages/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://gqynptpjomcqzxyykqic.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "<service_role_key>"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

## 제공 도구

| 도구 | 설명 |
|---|---|
| `list_tutorials` | 매뉴얼 목록 검색 |
| `get_steps` | 매뉴얼의 전체 step 목록 |
| `get_step_detail` | step 상세 (selector, 좌표, 스크린샷) |

## 실행 흐름

```
Claude: "Parro에서 '쿠팡 장바구니' 매뉴얼 실행해줘"
  → list_tutorials(query="쿠팡 장바구니")
  → get_steps(tutorial_id)
  → 각 step마다:
      get_step_detail(step_id)
      → element_selector로 클릭 시도
      → 실패 시 click_x/y 좌표로 fallback
```

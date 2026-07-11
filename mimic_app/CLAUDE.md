# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

## Parro Manual Content Rule

When changing capture/finalize, Claude prompts, fallback title/script generation, annotation labels, or manual editor rendering, follow [docs/MANUAL_CONTENT_RULES.md](./docs/MANUAL_CONTENT_RULES.md) first.

Manual content must be written from the user's task goal, not from raw click targets. Avoid defaulting to `{domain or element text} + 클릭합니다`. The title explains the purpose, the body explains what the user should do and why, and the annotation label only marks the target location.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 5. Git 브랜치 규칙

**반드시 따를 것 — 모든 에이전트/매니저 공통**

> 📋 기능 개발·배포 **표준 순서는 [DEV_PROCESS.md](./DEV_PROCESS.md)** 참조 (커밋 → dev push=Preview → 검증 → main push=Production).

```
main  ←  프로덕션. Vercel 자동 배포. 직접 커밋 금지.
dev   ←  개발 통합. 모든 작업은 여기서 시작.
```

### 작업 순서
1. 세션 시작 시 반드시 `dev` 브랜치에 있는지 확인: `git branch`
2. `main`에 있으면 즉시 전환: `git checkout dev`
3. 코딩 → 커밋은 `dev`에서: `git commit -m "feat/fix/chore: ..."`
4. 배포 요청이 오면:
   - 빌드 확인: `npm run build`
   - `main`에 병합: `git checkout main && git merge dev`
   - 프로덕션 배포: `vercel --prod` (NODE_OPTIONS="--use-system-ca" 필요)
   - 다시 `dev`로 복귀: `git checkout dev`

### 커밋 메시지 규칙
- `feat:` 새 기능
- `fix:` 버그 수정
- `chore:` 설정/정리
- `style:` UI/스타일
- `refactor:` 리팩토링

### ⚠️ 절대 하지 말 것
- `main`에 직접 커밋
- 빌드 실패 상태로 배포
- `--no-verify` 플래그 사용

---

## 6. DB 안전 가드레일 (절대 규칙 — 모든 에이전트/세션 공통)

> 🔴 **운영 DB 사고는 절대 안 된다.** dev와 운영은 완전히 분리된 별개 Supabase 프로젝트이며, 절대 섞거나 한쪽을 다른 쪽으로 옮기지 않는다. 상세 셋업은 [DEV_PROCESS.md](./DEV_PROCESS.md).

### 프로젝트 식별 (혼동 금지)
| 구분 | Supabase 프로젝트 | 비고 |
|------|-------------------|------|
| **운영(prod)** | `gqynptpjomcqzxyykqic` (싱가포르) | 실제 고객 데이터. Claude MCP로 **접근 가능** → 극도로 주의 |
| **개발(dev)** | `dskphgxurxebblnpwhax` (도쿄, 별도 계정) | Parro 전용. **MCP 미연결** → 대시보드 SQL Editor / service_role REST로만 조작 |
| (폐기) 옛 공유 dev | `xsfriegbpygydcqhsqqq` | Parro 안 씀. 타 앱 실데이터 있음 → **건드리지 말 것** |

### 연결 배선 (고정 — 절대 변경 금지)
- localhost(`npm run dev`) → **dev DB** (`.env.development.local`)
- Vercel **Preview**(dev 브랜치) → **dev DB**
- Vercel **Production**(main 브랜치) → **운영 DB**

### ⛔ 절대 금지
- 운영(`gqyn…`)에 **테스트/더미/시드 데이터 INSERT**
- **dev↔운영 데이터 복사·이전·동기화** (어느 방향이든. 특히 dev를 운영으로 "마이그레이션"하거나 두 DB를 합치는 것)
- env를 바꿔 **dev/Preview/localhost가 운영 DB를 가리키게**, 또는 **운영이 dev DB를 가리키게** 하는 것
- 운영에 **DROP / DELETE / TRUNCATE / 스키마 마이그레이션을 사용자 확인 없이** 실행
- MCP `apply_migration`/`execute_sql` 호출 전 **project_id 미확인** (반드시 `gqyn…`=운영인지 확인)

### ✅ 기본 원칙
- 모든 **테스트·시드·실험·디버깅 쿼리는 dev**에서. 운영은 읽기/진단도 최소화.
- **스키마 변경 = "복사/이전"이 아니라 "양쪽에 같은 DDL을 각각 적용"**: 운영=MCP `apply_migration`(project_id 확인), dev=대시보드 SQL Editor. 데이터는 절대 옮기지 않는다.
- 운영에 쓰기/마이그레이션이 꼭 필요하면 **실행 전 사용자에게 명시적으로 확인**받는다.
- dev 테스트 계정: `test@naver.com`(PRO) / `testfree@naver.com`(FREE), 둘 다 `Devtest1234`.

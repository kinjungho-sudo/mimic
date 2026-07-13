# CLAUDE.md

## ⚠️ 작업 시작 전 필독 문서

이 프로젝트의 제품 방향, 기술 설계, 작업 원칙은 루트 문서에 정의되어 있다.
**모든 작업 전 아래 두 문서를 먼저 읽어라.**

- 제품 설계서: `../MIMIC_PRODUCT_DESIGN_v2.md` — 5레이어 아키텍처, PRD, DB 스키마, 작업 원칙
- 제품 철학: `../MIMIC_WHY.md` — 타겟 고객, 문제 정의, 비전

---

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

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

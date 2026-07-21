# Parro Semi-Auto Benchmark Loop — Codex Runbook

> 작성자: MAX / CoMind Works Development Lead Agent
> 목적: 정호님이 여행 중 짧은 프롬프트만 입력해도 Codex가 Parro DEV 브랜치에서 1회차 반복 개선 루프를 실행하도록 하는 운영 문서
> 적용 범위: Parro / former MIMIC, DEV 계열 브랜치 전용

---

## 0. 핵심 결론

Codex에게 3일 전체를 통째로 맡기지 않는다.

```text
MAX/Hermes = 루프 운영자
Codex = 한 사이클 실행자
정호님 = 방향 제시 + 고위험 승인
```

정호님은 매번 긴 지시를 쓰지 않고, 아래 짧은 프롬프트만 입력한다.

```text
Read docs/codex/PARRO_SEMI_AUTO_BENCHMARK_LOOP.md and run the next Parro semi-auto benchmark loop cycle. Stay on the DEV branch only. Do not touch main. No repo worklog = not done.
```

Codex는 이 문서를 읽고 **한 번의 루프 사이클만** 실행한다.
사이클이 끝나면 worklog, 검증 결과, 승인 큐, commit hash를 남긴다.
다음 사이클은 최신 worklog를 읽고 다시 실행한다.

---

## 1. Absolute Branch Safety Rules

### 반드시 지킬 것

- `main` 직접 작업 금지
- `main` 직접 commit 금지
- `main` push 금지
- `main` merge 금지
- production 배포 금지
- production DB 변경 금지

### 허용되는 작업 브랜치

아래 중 하나의 DEV 계열 브랜치에서 시작한다.

```text
dev
develop
brand/parro-system
```

그리고 실제 반복 작업은 DEV 계열 브랜치에서 파생한 loop branch에서 수행한다.

```text
dev/parro-3day-benchmark-loop-YYYYMMDD
```

또는 같은 브랜치가 이미 있다면 재사용한다.

### 시작 시 필수 확인 명령

```bash
git fetch origin
git branch --show-current
git status --short
```

현재 브랜치가 `main`이면 즉시 멈추고 보고한다.
사용자 승인 없이 `main`에서 loop branch를 만들지 않는다.

---

## 2. Semi-Auto Loop Operating Model

한 사이클은 아래 순서로만 진행한다.

```text
1. 최신 문서와 worklog 읽기
2. 현재 branch가 DEV 계열인지 확인
3. 이번 사이클 번호 결정
4. 이번 사이클 benchmark focus 선택
5. 6개 루프 검사
6. 저위험 문제만 수정
7. 고위험 문제는 approval queue에 기록
8. 검증 명령 실행
9. worklog 작성
10. implementation-log / review-notes / mistakes 업데이트
11. commit 생성
12. 다음 사이클 추천 작성
```

Codex는 한 번의 프롬프트에서 **한 사이클만** 끝낸다.
무한 루프를 돌리지 않는다.

---

## 3. Cycle Focus Rotation

최신 `docs/worklogs/codex/*parro*benchmark*loop*.md`를 읽고 다음 cycle number를 결정한다.

### Cycle 1 — Runtime Foundation

목표:

```text
DEV 브랜치 안전 확인 + install/lint/test/build/dev 실행 가능성 확인
```

우선순위:

1. branch safety
2. package manager 확인
3. install/build/lint/test/dev script 확인
4. desktop run script 확인
5. 실행 불가 blocker 기록

대규모 UI 변경 금지.

### Cycle 2 — Scribe Capture Flow Audit

목표:

```text
Scribe-like desktop capture 핵심 흐름 감사
```

검증 흐름:

```text
start recording
→ click target app/window/display
→ clicked display/window only capture
→ click highlight
→ side-panel step
→ finish
→ automatic manual/editor navigation
```

저위험 수정:

- 버튼 연결 누락
- finish 후 navigation 누락
- side panel 표시 누락
- 상태 피드백 문구 부족

고위험 승인 큐:

- capture architecture 변경
- OS permission 정책 변경
- screenshot 저장/업로드 정책

### Cycle 3 — Click Highlight + Step Panel

목표:

```text
클릭 후 사용자에게 즉시 보이는 feedback 품질 개선
```

벤치마크:

- Scribe step list
- Tango step documentation

검증:

- 클릭마다 step이 생성되는가
- step에 이미지/제목/순서가 명확한가
- 클릭 위치 highlight가 보이는가
- 빈 상태/실패 상태가 있는가

### Cycle 4 — Finish → Manual Editor Navigation

목표:

```text
캡처 완료 후 자동 매뉴얼/편집 화면으로 자연스럽게 이동
```

검증:

- finish CTA 명확성
- completion state
- generated draft/manual 존재 여부
- editor 진입점
- 실패 시 복구 안내

### Cycle 5 — UI/UX + Product Completeness

목표:

```text
Parro가 일반 챗봇이 아니라 workflow recorder / AI Live Guide로 보이는지 개선
```

벤치마크:

- Scribe first-run clarity
- Guidde AI generation positioning
- Supademo/Arcade demo clarity

저위험 수정:

- product copy
- onboarding text
- empty/loading/error state
- demo labels

### Cycle 6 — Security/Data + Approval Queue Consolidation

목표:

```text
캡처/이미지/로그/데이터 정책 리스크 정리와 다음 3일 계획 업데이트
```

검증:

- screenshot 민감정보 리스크
- capture consent 표시
- local/cloud 저장 구분
- logs에 개인정보/경로 과다 노출 여부
- `.env`, token, key 노출 여부
- `.gitignore` 안전성

마지막에는 approval queue를 정리한다.

### Cycle 7 이후

Cycle 1~6을 반복하되, 최신 blocker와 approval queue를 기준으로 focus를 조정한다.

---

## 4. Six Required Loops

매 사이클마다 아래 6개를 모두 훑되, **이번 cycle focus에 가장 많은 시간을 쓴다.**

| Loop | 목적 | 자동수정 허용 | 승인 필요 |
|---|---|---|---|
| 1. Code Stability | 타입/린트/테스트/의존성 안정성 | 타입, lint, import, null guard | 아키텍처/패키지 교체 |
| 2. Runtime/Build | install/build/dev/desktop 실행 | script 연결, 라우트, 에러상태 | prod config, 배포, OS 권한 |
| 3. Core Scenario | capture 핵심 플로우 | navigation, step 표시, 피드백 | capture 구조, manual 생성 구조 |
| 4. UI/UX | 사용성/명확성 | copy, spacing, empty state | full redesign, 브랜드 변경 |
| 5. Security/Data | 캡처/로그/비밀정보 안전 | warning, log 축소, gitignore | cloud upload, retention, auth |
| 6. Product Completeness | 경쟁사 수준 제품성 | onboarding/docs/copy | 타겟/가격/MVP 변경 |

---

## 5. Competitor Benchmarking Rule

각 사이클 시작 시 benchmark 하나를 고른다.

우선순위:

1. Scribe
2. Tango
3. Guidde
4. Supademo / Arcade / Loom

절차:

```text
1. 경쟁사에서 관찰 가능한 기준 3~5개를 뽑는다.
2. Parro에 맞는 acceptance criteria로 번역한다.
3. 현재 Parro가 충족하는지 검사한다.
4. 저위험 gap만 수정한다.
5. 큰 제품/기술 결정은 approval queue에 넣는다.
```

주의:

```text
경쟁사를 그대로 복제하지 말 것.
Parro의 방향은 AI Live Guide / workflow recorder다.
```

---

## 6. Auto-Fix Policy

### 자동수정 가능

- 타입 오류
- lint 오류
- import/export 오류
- 명백한 runtime error
- 버튼 연결 누락
- finish 후 navigation 누락
- side panel step 표시 누락
- click feedback UI 버그
- empty/loading/error state 추가
- product copy 개선
- docs/worklog 보완
- `.gitignore` 안전 보완
- 과도한 로그 축소

### 승인 필요

- `main` 관련 모든 변경
- production 배포
- DB schema 변경
- Supabase RLS/auth 변경
- cloud upload of captures
- external API로 screenshot 전송
- 캡처 데이터 보존 정책
- 가격/결제/구독
- LMS/marketplace/video hosting 확장
- target customer 변경
- 전체 IA/브랜드 리디자인
- desktop capture architecture 대규모 변경

승인 필요 항목은 반드시 `docs/approval-queue.md`에 기록한다.

---

## 7. Required Files to Read

작업 전 가능한 범위에서 읽는다.

```text
AGENTS.md
CLAUDE.md
docs/mistakes.md
docs/codex/CODEX_WORKLOG_PROTOCOL.md
docs/codex/PARRO_SEMI_AUTO_BENCHMARK_LOOP.md
docs/approval-queue.md
docs/review-notes.md
docs/implementation-log.md
latest docs/worklogs/codex/*parro*benchmark*loop*.md
```

없는 파일은 만들되, 없는 것을 실패로 보지 않는다.

---

## 8. Required Outputs Per Cycle

각 사이클 종료 시 반드시 남긴다.

```text
docs/worklogs/codex/YYYY-MM-DD_parro_benchmark_loop_cycle-N.md
docs/approval-queue.md
docs/review-notes.md
docs/implementation-log.md
```

필요하면 업데이트:

```text
docs/mistakes.md
```

중요 규칙:

```text
No repo worklog = not done.
```

---

## 9. Worklog Template

```markdown
# Parro Benchmark Loop Cycle N — YYYY-MM-DD

## Branch Safety
- Current branch:
- Base DEV branch:
- Confirmed not main: yes/no
- Main touched: no

## Files Read
-

## Benchmark Focus
- Competitor:
- Observed quality standards:
  1.
  2.
  3.
- Parro acceptance criteria:
  1.
  2.
  3.

## Six Loop Results
| Loop | Result | Issues Found | Auto-fixed | Approval Needed | Notes |
|---|---|---:|---:|---:|---|
| Code Stability | | | | | |
| Runtime/Build | | | | | |
| Core Scenario | | | | | |
| UI/UX | | | | | |
| Security/Data | | | | | |
| Product Completeness | | | | | |

## Changes Made
-

## Verification Commands
```bash
# command
# actual output summary
```

## Approval Queue Additions
-

## Blockers / Unverified
-

## Commit
- Commit hash:

## Next Cycle Recommendation
-
```

---

## 10. Verification Commands

package manager를 확인하고 있는 script만 실행한다.

예시:

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm dev
```

또는:

```bash
npm install
npm run lint
npm test
npm run build
npm run dev
```

desktop app은 package.json 또는 docs에 있는 script만 사용한다.
없는 script를 지어내지 않는다.

---

## 11. Commit Rules

작은 단위로 commit한다.

```bash
git status --short
git add <changed-files>
git commit -m "chore: run Parro benchmark loop cycle N"
```

기능 수정이 있으면 더 구체적으로 작성한다.

예시:

```text
fix: stabilize Parro capture step panel
feat: add capture click feedback state
style: clarify Parro recorder onboarding copy
docs: add Parro benchmark loop cycle 2 worklog
```

push는 DEV loop branch에만 한다.

---

## 12. Final Response Format to User/MAX

Codex는 사이클 종료 후 아래 형식으로 보고한다.

```markdown
# Parro Semi-Auto Benchmark Loop — Cycle N Complete

## Branch
- Current branch:
- Confirmed main untouched: yes/no

## Benchmark Focus
-

## What changed
-

## Verification
-

## Worklog
- Path:

## Commit
- Hash:

## Approval needed
1.

## Blockers
-

## Recommended next prompt
Continue with Cycle N+1 focusing on ...
```

---

## 13. Short Prompt 정호님이 Codex에 입력할 문장

매번 아래 문장만 입력하면 된다.

```text
Read docs/codex/PARRO_SEMI_AUTO_BENCHMARK_LOOP.md and run the next Parro semi-auto benchmark loop cycle. Stay on the DEV branch only. Do not touch main. Use the latest worklog and approval queue to decide the next cycle number and focus. Only auto-fix low-risk issues. Put high-risk product/security/data/architecture decisions into docs/approval-queue.md. Write a repo worklog and commit your changes. No repo worklog = not done.
```

---

## 14. Korean Short Prompt

```text
docs/codex/PARRO_SEMI_AUTO_BENCHMARK_LOOP.md를 읽고 Parro 반자동 벤치마크 개선 루프의 다음 사이클을 실행해줘.
DEV 브랜치에서만 작업하고 main은 절대 건드리지 마.
최신 worklog와 approval queue를 읽어서 다음 cycle 번호와 focus를 정해.
저위험 문제만 자동수정하고, 제품/보안/데이터/아키텍처 고위험 결정은 docs/approval-queue.md에 기록해.
작업 후 repo worklog를 남기고 commit까지 해줘.
No repo worklog = not done.
```

---

## 15. Stop Conditions

아래 상황에서는 즉시 멈추고 보고한다.

- 현재 branch가 `main`임
- DEV 계열 branch를 찾을 수 없음
- secrets가 staged 됨
- production DB/env 변경이 필요함
- capture cloud upload가 필요함
- OS 권한/보안 정책 변경이 필요함
- build failure 원인이 대규모 구조 변경 없이는 해결 불가함
- 테스트가 실제 사용자 데이터나 운영 DB를 건드릴 위험이 있음

---

## 16. MAX Review 기준

MAX는 Codex 결과를 다음 기준으로 검토한다.

- main을 건드리지 않았는가
- DEV branch에서만 작업했는가
- worklog가 repo에 남았는가
- 검증 명령 실제 결과가 있는가
- 저위험/고위험 분류가 적절한가
- 경쟁사 기준이 Parro 방향에 맞게 번역되었는가
- Scribe-like capture 핵심 흐름이 전진했는가
- approval queue가 정리되었는가

이 기준을 통과하지 못하면 다음 사이클 전에 보완 지시를 낸다.

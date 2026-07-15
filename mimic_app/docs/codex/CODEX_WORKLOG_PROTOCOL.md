# Codex Worklog Protocol — MAX ↔ Codex GitHub Shared Context

> 파일: `docs/codex/CODEX_WORKLOG_PROTOCOL.md`  
> 작성자: MAX / CoMind Works Development Lead Agent  
> 작성일: 2026-07-16  
> 프로젝트: Parro — 기존 MIMIC  
> 목적: MAX가 지시서를 만들고, Codex가 GitHub/repo worklog로 결과를 남겨 MAX와 공유/검토할 수 있게 하는 운영 규칙

---

## 1. 원칙

Parro 개발에서 Codex는 작업 결과를 단순 채팅 보고로 끝내지 않는다.

Codex는 반드시 repository 안에 **작업 로그 파일**을 남겨야 한다.

```text
MAX 지시서
→ Codex 구현
→ Codex worklog 작성
→ GitHub branch/commit/PR 공유
→ MAX가 worklog + diff + 테스트 결과를 검토
→ 부족하면 MAX가 후속 지시서 작성
```

이 방식이 기본 운영 방식이다.

---

## 2. Worklog 저장 위치

Codex는 작업마다 아래 위치에 worklog를 생성한다.

```text
docs/worklogs/codex/YYYY-MM-DD_<short-task-slug>.md
```

예시:

```text
docs/worklogs/codex/2026-07-16_desktop-capture-scribe-parity.md
```

`docs/worklogs/codex/` 폴더가 없으면 생성한다.

---

## 3. Worklog 필수 내용

각 worklog에는 반드시 아래 항목을 포함한다.

```markdown
# Codex Worklog — <작업명>

## 1. Source Brief
- 읽은 MAX 지시서:
- 관련 브랜치:
- 작업 시작 커밋:

## 2. Files Read
- 실제로 읽은 파일 목록

## 3. Changes Made
- 변경 파일 목록
- 파일별 변경 요약

## 4. Product Behavior Implemented
- 사용자 입장에서 실제로 바뀐 동작

## 5. Verification
- 실행한 명령
- 실제 출력 요약
- 통과/실패 여부

## 6. Manual QA
- 직접 확인한 항목
- 확인하지 못한 항목
- 확인 불가 이유

## 7. Known Limitations / Blockers
- 남은 문제
- 환경/권한/런타임 제약

## 8. Next Actions for MAX
- MAX가 검토해야 할 것
- 후속 지시가 필요한 것
```

---

## 4. Desktop Capture 작업 전용 추가 항목

Desktop Capture 관련 작업에서는 아래 항목을 반드시 추가한다.

```markdown
## Desktop Capture Specific Report

### Desktop Runtime
- Electron/Tauri/native runtime 존재 여부:
- global click listener 구현 가능 여부:
- OS screen recording permission 처리 여부:

### Multi-Monitor Capture
- 클릭한 display만 캡처하는 방식:
- virtual desktop 전체 캡처 방지 방식:
- HiDPI/scaleFactor 처리:

### Step Preview
- side panel thumbnail 표시 방식:
- click highlight 표시 방식:

### Finalize Flow
- finalize API:
- 생성된 manual/tutorial id 처리:
- editor 자동 이동 route:
```

---

## 5. GitHub 공유 규칙

Codex는 작업 후 가능한 한 아래 중 하나로 공유한다.

### A. Commit까지 한 경우

보고에 포함:

```text
branch:
commit:
worklog path:
test output:
```

### B. PR까지 만든 경우

보고에 포함:

```text
PR URL:
branch:
worklog path:
verification summary:
```

### C. Commit/PR을 못 한 경우

보고에 포함:

```text
왜 commit/push/PR을 못 했는지
로컬 변경 파일
worklog path
다음에 실행할 git 명령
```

---

## 6. MAX 검토 기준

MAX는 Codex 결과를 볼 때 아래 순서로 확인한다.

1. worklog가 존재하는지
2. Source Brief를 정확히 읽었는지
3. 변경 파일이 범위 안인지
4. 금지 범위를 건드리지 않았는지
5. 테스트/빌드 결과가 실제 출력인지
6. 수동 QA가 필요한 항목을 숨기지 않았는지
7. 제품 기준을 충족했는지
8. 후속 지시가 필요한지

---

## 7. Codex에게 줄 기본 문장

Codex 작업 프롬프트에는 항상 아래 문장을 포함한다.

```text
작업 후에는 반드시 docs/worklogs/codex/YYYY-MM-DD_<task>.md 형식으로 worklog를 남기세요.
worklog에는 읽은 파일, 변경 파일, 구현 내용, 검증 명령과 실제 출력, 수동 QA 결과, 미검증 항목, blocker, MAX가 검토해야 할 다음 액션을 포함하세요.
가능하면 GitHub branch에 commit/push하고, commit hash 또는 PR URL을 보고하세요.
채팅 보고만 하고 worklog를 남기지 않으면 작업 완료로 보지 않습니다.
```

---

## 8. 중요 품질선

Codex의 채팅 보고는 사라지거나 MAX가 직접 볼 수 없을 수 있다. 따라서 GitHub/repo에 남는 worklog가 공유 컨텍스트의 기준이다.

```text
No worklog in repo = MAX cannot reliably review = not done
```

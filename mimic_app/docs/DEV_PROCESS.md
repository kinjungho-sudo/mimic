# 개발·배포 프로세스 (Parro)

기능 개발 요청 시 **반드시 이 순서**를 따른다.

## 전제 (현재 인프라)
- **Vercel = GitHub 연동 자동 배포.** "Vercel 배포"는 별도 수동 단계가 아니라 **push로 트리거**된다.
  - `dev`에 push → Vercel **Preview** 자동 배포
  - `main`에 push → Vercel **Production** 자동 배포
- **커밋은 항상 push보다 먼저.** push와 배포는 같은 동작이다.

## 표준 순서

| 단계 | 동작 | 결과 |
|---|---|---|
| 1 | `git fetch origin dev` 후 최신 `origin/dev`에서 `feat/parro-*` worktree 생성 | 기능별 격리 작업 |
| 2 | guard와 범위별 lint/build를 통과한 feat를 검증 후 `dev`에 통합·push | **Preview** 자동 배포 |
| 3 | 사용자가 **Preview URL(또는 로컬 `npm run dev`)에서 테스트·검증** | OK 판단 |
| 4 | `git checkout main && git merge dev && git push origin main` | **Production** 자동 배포 |

> 4단계 CLI 폴백: `vercel --prod` (`NODE_OPTIONS="--use-system-ca"` 필요). 배포 후 `dev`로 복귀.

## 검증 체크
- 배포 후 deployment **state=READY** 확인.
- 주요 라우트 응답 확인(`/home` → 미정상 시 로그인 리다이렉트면 정상).
- **env는 Production·Preview 스코프 둘 다** 설정돼 있어야 함 (Preview 누락 시 미들웨어 500 = `MIDDLEWARE_INVOCATION_FAILED`).

## 금지
- `main` 직접 커밋 금지.
- `dev` 또는 배포 전용 worktree에서 직접 기능 개발 금지.
- 기능 worktree에 `.vercel` 프로젝트 링크 생성 금지.
- 빌드 실패 상태로 push/배포 금지.
- `--no-verify` 금지.

상세 worktree 및 배포 guard는 [Parro Worktree Migration](./brand/parro-worktree-migration.md)을 따른다.

## 커밋 메시지
`feat:` 새 기능 · `fix:` 버그 · `chore:` 설정/정리 · `style:` UI · `refactor:` 리팩토링

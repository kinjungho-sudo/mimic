# Parro 조치 계획 (2026-10-08 분석 기반)

작업 브랜치: `feat/parro-security-remediation` (worktree `D:\project\dev\_worktrees\parro-security-remediation`, base `origin/dev` 56b731e2).
단계마다 커밋하고, push·DB 적용·Production 승격은 정호님 승인 후 진행한다.

## 진행 순서

| # | 심각도 | 항목 | 상태 |
|---|---|---|---|
| 1 | 치명 | P0 보안 브랜치(bb05dda6) 반영: RPC 권한, Storage 정책, 계정 삭제 정리 | 코드 완료 · DB 미적용 |
| 2 | 치명 | `mm_users` 셀프 플랜 변경 차단, 공개 조회 정책 8개 제거, 토큰·anon insert 차단 (`20261008090000_p1_rls_lockdown.sql`) | 코드 완료 · DB 미적용 |
| 3 | 높음 | 비밀번호 공유 우회 3경로 차단 (PDF token export, `/api/guide/[token]`, `/api/p/[token]`) | 대기 |
| 4 | 높음 | 공유 비밀번호 무차별 대입 방어 (DB 기반 rate limit) | 대기 |
| 5 | 높음 | Recorder 외부 메시지 origin 일괄 검증, 운영 manifest localhost 제거 | 대기 |
| 6 | 높음 | Desktop: 운영 dev URL 고정, `auto` 캡처 모드 버그 | 대기 |
| 7 | 높음 | `parro/ui-assets` 브랜치 원격 백업 | 승인 필요 (push) |
| 8 | 중간 | Free 일일 한도 복구, contact/events/survey/pro-signup rate limit | 대기 |
| 9 | 중간 | 인증 세부 결함: `getSession`→`getClaims`, redeem 경쟁 조건, `server-only` | 대기 |
| 10 | 중간 | 평문 dev 자격증명 제거, 레거시 Edge Function·MCP 서버 소유권 검증 | 대기 |
| 11 | 중간 | 마이그레이션 번호 중복 정리 문서화, DEV_PROCESS 단일화 | 대기 |
| 12 | 중간 | 공유 설정(확장 ID·origin·버전) 단일 출처, CI(GitHub Actions) | 대기 |
| 13 | 중간 | 대형 파일 분리 (`background.js`, `home/page.tsx` 등) | 대기 |
| 14 | 낮음 | 루트 문서 Parro 기준 갱신, `_worktrees/` gitignore, 브랜치 정리 | 대기 (원격 삭제는 승인 필요) |
| 15 | — | 결제 연동 (PG 선택·가맹 계정 필요) | 정호님 결정 필요 |

## DB 적용 순서 (승인 후)

1. dev DB(dskphg…): SQL Editor에서 `20261004074748_p0_security_hardening.sql` → `20261008090000_p1_rls_lockdown.sql` 순서로 실행.
2. Preview에서 공유 링크(`/play`, `/p`, `/embed`), 로그인, Recorder 연결, 플랜 화면을 확인.
3. 운영 DB(project1): 같은 순서로 적용 후 Production에서 동일 확인.

두 마이그레이션은 현재 앱 코드와 호환된다(앱의 모든 테이블 접근은 service-role 서버 경로). 따라서 DB를 코드 배포보다 먼저 적용해도 된다.

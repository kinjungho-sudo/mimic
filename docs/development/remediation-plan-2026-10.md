# Parro 조치 계획 (2026-10-08 분석 기반)

작업 브랜치: `feat/parro-security-remediation` (worktree `D:\project\dev\_worktrees\parro-security-remediation`, base `origin/dev` 56b731e2).
단계마다 커밋하고, push·DB 적용·Production 승격은 정호님 승인 후 진행한다.

## 진행 상태 (2026-10-08 기준, 모두 로컬 커밋 · 미배포)

| # | 심각도 | 항목 | 상태 |
|---|---|---|---|
| 1 | 치명 | P0 보안 브랜치(bb05dda6) 반영: RPC 권한, Storage 정책, 계정 삭제 정리 | 코드 완료 · DB 미적용 |
| 2 | 치명 | `mm_users` 셀프 플랜 변경 차단, 공개 조회 정책 8개 제거, 토큰·anon insert 차단 | 코드 완료 · DB 미적용 |
| 3 | 높음 | 비밀번호 공유 우회 3경로 차단 (서명된 12시간 접근 증명) | 완료 |
| 4 | 높음 | 공유 비밀번호 무차별 대입 방어 (DB 공유 rate limit) | 코드 완료 · DB 미적용 (적용 전엔 인메모리 대체) |
| 5 | 높음 | Recorder 외부 메시지 origin 일괄 검증 (1.7.41) | 완료 · 스토어 제출 필요 |
| 6 | 높음 | Desktop: 연결된 웹앱으로 이동, `auto` 캡처 모드 버그 (0.6.8 설치 파일 재빌드) | 완료 |
| 7 | 높음 | `parro/ui-assets` 브랜치 원격 백업 | 승인 필요 (push) |
| 8 | 중간 | Free 일일 한도 복구(KST 당일 생성 수), AI·공개 폼 rate limit | 완료 |
| 9 | 중간 | `getSession`→`getClaims`, redeem 경쟁 조건, `server-only` | 완료 |
| 10 | 중간 | 평문 dev 자격증명 제거, Edge Function 소스 제거, MCP 소유권 검증 | 완료 · 운영 `analyze-step` 함수 삭제는 승인 필요 |
| 11 | 중간 | 마이그레이션 README, DEV_PROCESS 기준 문서 지정 | 완료 |
| 12 | 중간 | 공유 설정 드리프트 검사(`packages/parro-config`), CI(GitHub Actions) | 완료 |
| 13 | 중간 | 대형 파일 분리 | 보류 — 별도 브랜치에서 단계적으로 (아래) |
| 14 | 낮음 | OVERVIEW 갱신, `_worktrees/` gitignore | 완료 · 브랜치·worktree 정리는 승인 필요 |
| 15 | — | 결제 연동 | 정호님 결정 필요 |

### 의도적으로 유지한 것

- 운영 manifest의 localhost `externally_connectable`: 운영 빌드는 런타임 입구 검증에서 localhost를 거부한다. 빌드에서 제거하면 패키지 실브라우저 검증이 불가능해진다.
- 설치 마법사의 dev 확장 ID: 악용하려면 사용자가 악성 unpacked 확장을 직접 설치해야 하고, 제거하면 dev Recorder–Desktop 연동이 끊긴다.
- Native Messaging host 이름 `com.mimic.desktop_companion.dev`: AGENTS.md의 호환 식별자. 바꾸면 기존 설치가 끊긴다.

### 13번을 별도로 하는 이유

`background.js` 등 Recorder 파일은 수십 개의 계약 테스트가 소스 문자열로 검사하고, 스토어 zip 화이트리스트가 PS1·PY 두 벌이다. 화면 대형 파일은 UI 테스트가 없다.
보안 변경과 섞으면 회귀 원인을 가리기 어려우므로, 파일마다 (1) 동작 고정 테스트 추가 → (2) 순수 이동 커밋 → (3) 정리 순서로 진행한다.

## DB 적용 순서 (승인 후)

1. dev DB: SQL Editor에서 `supabase/migrations/README.md`의 순서(P0 → P1 → rate limit)로 실행.
2. Preview에서 공유 링크(`/play`, `/p`, `/embed`), 비밀번호 공유 + Live Guide, 로그인, Recorder 연결, 녹화 완료, 플랜 화면 확인.
3. 운영 DB: 같은 순서로 적용 후 Production에서 동일 확인.

세 마이그레이션은 현재 앱 코드와 호환된다(앱의 모든 테이블 접근은 service-role 서버 경로). DB를 코드 배포보다 먼저 적용해도 된다.

## 배포 시 함께 확인할 것

- Vercel `NEXT_PUBLIC_DESKTOP_LATEST_VERSION`이 설정돼 있다면 `0.6.8`로 갱신 (없으면 코드 기본값 0.6.8).
- 선택: `SHARE_ACCESS_SECRET` 설정 (없으면 service-role 키로 서명).
- 로컬 dev 게스트 로그인: `.env.development.local`에 `NEXT_PUBLIC_DEV_GUEST_EMAIL`·`NEXT_PUBLIC_DEV_GUEST_PASSWORD`.
- dev 테스트 계정 비밀번호는 git 이력에 남아 있으므로 변경 권장.
- Recorder 1.7.41은 Chrome 웹스토어 제출이 필요하다. 구버전 Recorder는 비밀번호 보호 매뉴얼의 Live Guide만 401을 받고 나머지는 그대로 동작한다.

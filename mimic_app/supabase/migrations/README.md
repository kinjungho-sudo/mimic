# Supabase 마이그레이션 기준

## 무엇이 진실인가

1. `../dev-setup/01_mimic_dev_schema.sql` — 운영 DB 라이브 구조에서 추출한 전체 스키마. 새 dev 환경은 이것으로 만든다.
2. 그 이후 변경은 **타임스탬프 파일**(`YYYYMMDDHHMMSS_*.sql`)로만 추가하고, 같은 변경을 스냅샷에도 반영한다.

`001`~`044` 번호 파일은 초기 개발 이력이다. 운영 DB와 어긋나 있으므로 **재실행하지 않는다**.
다음 번호는 같은 번호를 두 파일이 쓰고 있다: `027`, `028`, `031`, `033`, `036`, `038`. 이력 보존을 위해 이름은 바꾸지 않는다.

## 2026-10 보안 조치 적용 순서

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `20261004074748_p0_security_hardening.sql` | 권한 상승 RPC를 service_role 전용으로, Storage 쓰기 정책 정리 |
| 2 | `20261008090000_p1_rls_lockdown.sql` | `mm_users` 직접 수정 차단, 공개 조회 정책 제거, 토큰·anon insert 차단 |
| 3 | `20261008100000_shared_rate_limits.sql` | 인스턴스 간 공유 rate limit (`consume_rate_limit`) |

각 파일은 `begin; … commit;`으로 감싸져 있어 실패하면 전체가 롤백된다. 앱 코드는 세 파일 적용 전·후 모두에서 동작한다
(rate limit은 RPC가 없으면 인메모리로 대체).

적용 절차: dev DB(SQL Editor) → Preview 확인 → 운영 DB → Production 확인. 상세는 `../../DEV_PROCESS.md`.

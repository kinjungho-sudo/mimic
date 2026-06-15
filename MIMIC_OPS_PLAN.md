# MIMIC 운영 인프라 구축 계획서

> 작성일: 2026-06-12
> 목적: 1인 운영 체제에서 "고객에게 서비스하는 제품" 수준의 안정성 확보
> 원칙: **① 고객 데이터 보호 → ② 장애 빠른 인지 → ③ 빠른 복구.** 코드는 다시 짤 수 있지만 데이터와 신뢰는 복구 불가.

---

## 0. 현재 상태 진단 (As-Is)

| 영역 | 현재 상태 | 위험도 |
|---|---|---|
| DB | 로컬 개발과 프로덕션이 **동일한 Supabase 프로젝트**(gqynptpjomcqzxyykqic) 공유 | 🔴 높음 — 개발 실수가 곧바로 고객 데이터 사고 |
| 백업 | Supabase 백업 정책 미확인 | 🔴 높음 — 복구 가능 여부 모름 |
| 코드 보관 | 로컬 main이 GitHub origin보다 20+커밋 앞섬 | 🟠 중간 — 장비 고장 시 작업 유실 |
| 배포 | 로컬에서 `vercel --prod` 수동 실행 | 🟠 중간 — 배포 내용 추적 어려움, 롤백 절차 없음 |
| 모니터링 | mm_logs 테이블만 존재(수동 조회) | 🟠 중간 — 장애를 고객이 먼저 발견 |
| 마이그레이션 | 파일 번호 수동 관리, 적용 여부 추적 없음 (031 중복 발생 사례) | 🟡 낮음 |
| 테스트 데이터 | 검증 계정(verify-bot@mimicflow.com)·검증용 매뉴얼이 prod DB에 존재 | 🟡 낮음 — 정리 필요 |

### 보유 자원
- Supabase 프로젝트 2개: `project1`(gqynptpjomcqzxyykqic, 싱가포르) = **prod**, `project2`(xsfriegbpygydcqhsqqq, 도쿄) = 미사용 → **dev로 전환**
- GitHub 저장소: `kinjungho-sudo/mimic` (모노레포: mimic_app + mimic_recorder + packages)
- Vercel 프로젝트: `mimic` (CLI 연결됨, 프로덕션 alias: mimic-nine-ashen.vercel.app)
- 마이그레이션 SQL 파일 31개 (`mimic_app/supabase/migrations/`)
- 장애 진단 로그: `mm_logs` + DEBUGGING.md 체계

---

## Phase 0 — 즉시 정리 (소요 ~30분, 위험 없음)

> 목표: 유실·노출 위험 제거. 오늘 바로 실행 가능.

| # | 작업 | 방법 | 완료 기준 |
|---|---|---|---|
| 0-1 | 검증 데이터 삭제 | prod DB에서 verify-bot 계정, "검증용" 매뉴얼, branding 버킷의 테스트 로고 삭제 | `auth.users`·`mm_tutorials`에서 해당 행 0건 |
| 0-2 | GitHub push | `git push origin main dev` | origin과 로컬 동기화 |
| 0-3 | 백업 정책 확인 | Supabase 대시보드 → Settings → Backups | 백업 주기·보존일 확인, 메모 |
| 0-4 | 리포 정리 | 루트의 verify-*.png 28개 → 삭제 또는 .gitignore, `.playwright-mcp/` .gitignore 추가 | `git status` 깨끗 |

**리스크**: 없음. 0-1만 prod 데이터를 건드리므로 삭제 전 대상 행을 SELECT로 한 번 확인 후 실행.

---

## Phase 1 — dev/prod DB 분리 (소요 0.5~1일, 가장 중요)

> 목표: 로컬 개발이 프로덕션 데이터를 절대 건드릴 수 없는 구조.

### 1-1. project2를 dev DB로 셋업
1. **스키마 적용**: 마이그레이션 001~031을 project2에 순서대로 적용 (Supabase MCP `apply_migration` 사용)
2. **스토리지 버킷 생성**: `screenshots`, `avatars`, `audio`, `mimic-tts`, `branding` (모두 public — prod와 동일 구성)
3. **Auth 설정 복제**:
   - Google OAuth: 같은 Google Cloud 프로젝트의 클라이언트를 쓰되, project2의 콜백 URL(`https://xsfriegbpygydcqhsqqq.supabase.co/auth/v1/callback`) 추가
   - Site URL / Redirect URL: `http://localhost:3000` 등록
   - 이메일 인증 설정 prod와 동일하게
4. **트리거/함수 확인**: 004_create_triggers 등 함수 기반 마이그레이션이 정상 적용됐는지 `list_tables`/SQL로 검증

### 1-2. 로컬 환경 전환
1. `.env.local`의 SUPABASE 3종(URL, anon key, service role key)을 project2 값으로 교체 — **prod 키는 별도 파일(.env.production.local 등 .gitignore 대상)에 보관**
2. dev 서버 재시작 후 회원가입→캡처→편집→export 전체 흐름 1회 테스트
3. dev DB에 시드 데이터 생성 (테스트 계정 + 샘플 매뉴얼 1개)

### 1-3. 규칙 확립 (CLAUDE.md에 추가)
- 마이그레이션은 **dev DB에 먼저 적용 → 검증 → 배포 시점에 prod 적용**
- prod DB 직접 조작(MCP/SQL)은 장애 진단·배포 마이그레이션만 허용, 데이터 변경은 사전 확인 필수
- Supabase MCP 사용 시 project_id를 항상 명시 (기본값 의존 금지)

**리스크와 대응**:
- Google OAuth 콜백 누락 → 로컬 Google 로그인 실패: 이메일 로그인으로 우회 가능, 콜백 URL 추가로 해결
- prod에만 있고 마이그레이션 파일에 없는 스키마 변경(수동 변경분)이 있을 수 있음 → 적용 후 `information_schema` 비교로 차이 검출
- **prod는 건드리지 않는 작업**이므로 실패해도 처음부터 다시 하면 됨

### 1-4. 백업 강화 (고객 받기 시작하면)
- Supabase Pro 플랜 전환($25/월): 일일 백업 + PITR
- 분기 1회 복구 리허설: 백업에서 임시 프로젝트로 복원해보기

---

## Phase 2 — GitHub 연동 자동 배포 (소요 2~3시간)

> 목표: "무엇이 배포됐는지 항상 알 수 있고, 클릭 한 번에 롤백."

### 2-1. Vercel ↔ GitHub 연결
1. Vercel 대시보드 → mimic 프로젝트 → Settings → Git → `kinjungho-sudo/mimic` 연결
2. **Root Directory를 `mimic_app`으로 설정** (모노레포라 필수)
3. Production Branch = `main` 확인
4. 환경변수가 Vercel에 모두 있는지 확인: `vercel env ls` (BOM 오염 주의 — 기존 메모리 참조)

### 2-2. 새 배포 플로우
```
dev에서 작업 → 커밋 → push origin dev
  → Vercel이 dev 브랜치 Preview URL 자동 생성 → Preview에서 확인
배포: main에 병합 → push origin main
  → Vercel 자동 프로덕션 배포
롤백: Vercel 대시보드 → Deployments → 이전 배포 "Promote to Production"
```

### 2-3. 전환 검증
1. 연결 직후 dev에 사소한 커밋 push → Preview 생성 확인
2. main push → 프로덕션 자동 배포 확인 → 스모크 체크(랜딩 200, 로그인, export 1회)
3. 이전 배포로 롤백 → 다시 최신으로 promote (롤백 리허설)
4. CLAUDE.md 배포 절차 갱신: `vercel --prod` 수동 단계 제거, "빌드 확인 → main 병합 → push" 로 교체

**리스크와 대응**:
- 첫 자동 배포에서 빌드 설정 차이로 실패 가능 → 기존 CLI 배포가 살아 있으므로 서비스 영향 없음. 실패 시 Root Directory/빌드 커맨드 점검
- Vercel 무료(Hobby) 플랜은 상업적 사용 제한 있음 → 고객 과금 시작 전 Pro($20/월) 전환 필요

---

## Phase 3 — 모니터링·알림 (소요 2~3시간)

> 목표: 장애를 고객보다 먼저 안다.

| # | 작업 | 도구 | 비용 |
|---|---|---|---|
| 3-1 | 업타임 모니터 | UptimeRobot 무료 — 프로덕션 URL + `/api/guide/[테스트토큰]` 같은 API 1개 등록, 5분 간격, 이메일 알림 | 무료 |
| 3-2 | 에러 알림 | mm_logs에 error 레벨 발생 시 알림: Supabase pg_cron으로 10분마다 신규 error 카운트 → 있으면 이메일(Resend 등) 발송하는 Edge Function | 무료~ |
| 3-3 | (선택) Sentry | 클라이언트 측 예외 자동 수집. mm_logs가 못 잡는 프론트 크래시 보완 | 무료 플랜 |
| 3-4 | 주간 운영 루틴 | 아래 체크리스트를 주 1회 (10분) | - |

**주간 운영 체크리스트** (매주 월요일 권장):
- [ ] mm_logs 최근 7일 error/warn 조회 → 반복 패턴 있으면 이슈화
- [ ] Vercel 대시보드: 함수 에러율·트래픽 확인
- [ ] Supabase: DB 용량·스토리지 사용량 확인 (플랜 한도 대비)
- [ ] `git status` 깨끗한지, origin 동기화됐는지
- [ ] 백업 정상 생성 확인 (Pro 플랜 전환 후)

---

## Phase 4 — 마이그레이션·작업 규율 (소요 1시간, 문서 작업)

1. **마이그레이션 규칙** (CLAUDE.md에 추가):
   - 새 파일 생성 전 `ls supabase/migrations` 로 마지막 번호 확인 (병렬 작업 충돌 방지)
   - 파일 상단 주석에 `-- applied: dev 2026-06-12 / prod 2026-06-13` 형식으로 적용 기록
   - dev 먼저, prod는 배포와 함께
2. **031 중복 정리**: `031_trash_7days.sql` → `032_trash_7days.sql`로 리네임 (둘 다 prod 적용 완료 상태이므로 파일명만 정리)
3. **(나중) supabase CLI 도입 검토**: `supabase db push`로 적용 추적 자동화

---

## 이후 단계 (지금은 하지 않음 — 시점만 정의)

| 시점 | 작업 |
|---|---|
| 유료 고객 1팀 확보 | Supabase Pro + Vercel Pro 전환, 백업 복구 리허설 1회 |
| 월 활성 사용자 ~100명 | 스테이징 환경(dev 브랜치 전용 DB+Preview 고정), 핵심 플로우 E2E 테스트 CI |
| B2B 계약 발생 | status 페이지, 장애 대응 SLA 문서, 보안 점검(RLS 전수 검사 `get_advisors`) |
| (검토) | prod DB 리전이 싱가포르인데 사용자가 한국이면 도쿄/서울 리전 이전 검토 — 대형 작업이므로 별도 계획 필요 |

---

## 실행 순서 요약

```
Phase 0 (오늘, 30분)     : 검증 데이터 삭제 → push → 백업 확인 → 리포 정리
Phase 1 (반나절~1일)     : project2를 dev DB로 → .env.local 전환 → 규칙 문서화
Phase 2 (2~3시간)        : Vercel-GitHub 연동 → 롤백 리허설 → 배포 절차 갱신
Phase 3 (2~3시간)        : UptimeRobot → mm_logs 에러 알림 → 주간 루틴 시작
Phase 4 (1시간)          : 마이그레이션 규칙 + 031 정리
```

**총 예상 비용 (당장)**: 0원. 고객 과금 시작 시 Supabase Pro $25 + Vercel Pro $20 = 월 ~$45.

**의존 관계**: Phase 0 → 1 → 2 순서 권장 (1이 끝나야 "로컬 개발=안전"이 보장되고, 2가 끝나야 배포 추적·롤백 가능). 3, 4는 독립적이라 언제든 끼워넣기 가능.

---

## 관련 작업 지시서

- [통합 음성 파이프라인 완성 (APP)](mimic_app/VOICE_PIPELINE_TASK.md) — A입력→AI텍스트→B편집→TTS중심. 레코더는 데이터(텍스트·사람음성·구간)를 이미 넘기므로 앱은 해석·생성·재생·게이팅만. (2026-06-15)

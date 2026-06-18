# DEBUGGING — 장애 진단 / 로그 체계

장애가 "조용히" 발생하지 않도록(이번 스텝 삭제 미반영 버그처럼 `.catch(()=>{})`로 묻히지 않도록) 만든 로그 체계와 처리 프로세스.

## 1. 한눈에

| 레벨 | 저장 위치 | 용도 |
|------|-----------|------|
| `error` | **mm_logs (DB) + 콘솔** | 데이터 손실·실패. 반드시 남김 |
| `warn`  | **mm_logs (DB) + 콘솔** | 비정상이지만 복구된 상황 |
| `info` / `debug` | 콘솔만 (Vercel 런타임 로그) | 흐름 추적 |

- **클라이언트**: [lib/logging/logger.ts](../lib/logging/logger.ts) — `logError/logWarn/logInfo/logDebug` + 카테고리 `logAuditClient/logNetworkClient`. error/warn은 `navigator.sendBeacon`으로 `/api/logs`에 전송(페이지 이탈 중에도 보장).
- **서버(API 라우트)**: [lib/logging/logger-server.ts](../lib/logging/logger-server.ts) — `logServer(level, event, ctx, category)` / `logErrorServer` + 카테고리 `logAudit/logNetwork/logSystem`. service role로 mm_logs에 직접 insert.
- 로거는 **절대 throw하지 않음** — 로깅 실패가 앱 동작을 막지 않는다.
- 로그는 **카테고리**(error/network/audit/system)로 분류된다 → §7. 어드민에서 **`/admin/logs`**로 조회.

## 2. 로그 남기는 법

```ts
// 클라이언트 컴포넌트
import { logError } from '@/lib/logger';
deleteStep(stepId).catch((e) =>
  logError('step.delete.fail', { tutorialId: id, stepId, message: e instanceof Error ? e.message : String(e) })
);

// 서버 API 라우트
import { logServer } from '@/lib/logger-server';
if (error) {
  await logServer('error', 'step.delete.fail', { stepId: id, userId: auth.userId, message: error.message });
  return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
}
```

### event 네이밍 규칙
`<도메인>.<동작>.<결과>` — 소문자 점 표기. 예: `step.delete.fail`, `folder.create.fail`, `tutorial.moveFolder.fail`.
같은 버그를 클라/서버 양쪽에서 같은 event 코드로 남기면 추적이 쉽다.

### ⚠️ context에 PII 금지
`context`/`message`에는 **ID·상태값·HTTP status만**. 이메일·스크린샷·입력 텍스트 등 개인정보를 넣지 말 것. (앱의 PII 정책과 동일)

## 3. 로그 조회 (진단)

mm_logs는 RLS로 잠겨 있어 **service role(Supabase 대시보드 SQL 또는 Supabase MCP)**로만 조회한다.

```sql
-- 최근 에러 50개
select created_at, source, event, message, context, user_id, tutorial_id, url
from mm_logs
where level = 'error'
order by created_at desc
limit 50;

-- 특정 event 빈도 (어떤 장애가 잦은가)
select event, count(*) , max(created_at) as last_seen
from mm_logs
where level in ('error','warn') and created_at > now() - interval '24 hours'
group by event order by count desc;

-- 특정 매뉴얼에서 발생한 장애 추적
select * from mm_logs where tutorial_id = '<uuid>' order by created_at desc;
```

## 4. 트리아지 프로세스

1. **재현/제보 확보** — 사용자 화면·동작(예: "카드 🗑️로 삭제 후 매뉴얼 뷰에 살아남").
2. **로그 조회** — 위 SQL로 해당 시간대/매뉴얼/event를 좁힌다. event 빈도 쿼리로 "조용한 반복 장애"를 찾는다.
3. **DB 실제 상태 대조** — 로그가 가리키는 행이 DB에 실제로 어떤 상태인지 확인(이번 버그도 `mm_steps`에 행이 살아있는 걸 보고 확정). 로그 ↔ DB 불일치 = 영속화 누락 신호.
4. **근본 원인 → 수정 → 재발 방지** — 수정 후, 그 경로에 로깅이 없으면 추가한다.
5. **확인** — 동일 event가 더 이상 안 쌓이는지 재조회.

## 5. 신규 코드 규칙

- 새 `.catch(() => {})` / 빈 catch 금지. 최소 `logError(event, { message })`.
- 사용자 액션(삭제·저장 등)이 실패하면 **로깅 + 사용자 알림** 둘 다.
- API 라우트에서 5xx를 반환하기 직전 `logServer('error', ...)`.

## 6. 보관/정리 (TODO)

mm_logs는 무한 증가한다. 운영 안정화 후 보관기간 정책(예: 90일 초과 삭제) 크론을 추가할 것 —
`delete from mm_logs where created_at < now() - interval '90 days';`

## 7. 카테고리 로그 (에러 · 네트워크 · 감사 · 시스템)

`mm_logs.category`로 4종 분류(마이그레이션 [038](../supabase/migrations/038_add_log_category.sql)). `error`는 기존 규칙대로 error/warn만 저장하고, **network/audit/system은 정상(info) 로그도 항상 저장**한다(정상 동작 추적 목적).

| category | 무엇을 남기나 | 저장 레벨 | 헬퍼 |
|----------|--------------|-----------|------|
| `error`   | 개발·운영 중 장애/예외 | error·warn만 | `logErrorServer` / `logError` |
| `network` | Extension·외부서비스 연동 호출 결과(성공/실패) | 전 레벨 | `logNetwork` / `logNetworkClient` |
| `audit`   | 로그인 성공/실패·회원가입·탈퇴 등 보안 감사 | 전 레벨 | `logAudit` / `logAuditClient` |
| `system`  | cron 등 시스템 동작 정상 여부 | 전 레벨 | `logSystem` |

**현재 계측 지점(핵심)** — 점진 확장 가능:
- audit: `auth.login.success/fail`(구글=auth/callback, 비번=auth-client), `auth.signup`, `auth.account.delete`
- network: `extension.verify.success/fail`(확장 토큰), `email.send`/`email.send.fail`(n8n 외부 발송)
- system: `cron.cleanup-sessions`(매일 실행 결과 — 미수신 시 cron 미동작 신호)

> 새 외부연동/로그인/시스템 경로를 추가하면 같은 헬퍼로 계측을 함께 추가할 것.

## 8. Claude 온디맨드 모니터링 런북

상시 데몬은 없다. **버그 제보·점검 요청 시 Claude가 Supabase MCP(service role)로 아래를 조회**해 진단한다. (어드민은 `/admin/logs`에서 동일 데이터를 본다.)

### 이상징후 체크리스트 (heuristics)
```sql
-- (1) 에러 급증: 최근 1시간 에러 건수 / event별 빈도
select event, count(*), max(created_at) last_seen
from mm_logs where level='error' and created_at > now() - interval '1 hour'
group by event order by count desc;

-- (2) 로그인 실패 폭주(공격 의심): 감사 로그 실패 집계
select event, context->>'reason' reason, count(*)
from mm_logs where category='audit' and event like 'auth.login.fail%'
  and created_at > now() - interval '1 hour'
group by event, reason order by count desc;

-- (3) 외부연동 실패율: 네트워크 실패 vs 성공
select event, count(*)
from mm_logs where category='network' and created_at > now() - interval '24 hours'
group by event order by count desc;   -- *.fail 비중이 높으면 연동 장애

-- (4) 시스템 cron 동작 확인: 최근 cron 로그가 없으면 미동작
select event, max(created_at) last_run
from mm_logs where category='system'
group by event;                        -- last_run이 하루 이상 전이면 cron 점검
```

### 진단 흐름
1. 위 4개 쿼리로 카테고리별 이상 신호를 좁힌다.
2. error/audit는 §4 트리아지(로그 ↔ DB 실제 상태 대조)로 근본원인 확인.
3. network *.fail은 외부서비스(확장·n8n) 측 상태/응답코드(`context.status`) 확인.
4. 발견·조치 내용을 사용자에게 보고하고, 누락된 경로엔 §7 헬퍼로 계측 추가.

> **DB 분리 주의**: prod=project1 / dev=project2. 조회는 해당 환경 프로젝트에서, **prod에는 테스트 로그를 생성하지 말 것**.

# DEBUGGING — 장애 진단 / 로그 체계

장애가 "조용히" 발생하지 않도록(이번 스텝 삭제 미반영 버그처럼 `.catch(()=>{})`로 묻히지 않도록) 만든 로그 체계와 처리 프로세스.

## 1. 한눈에

| 레벨 | 저장 위치 | 용도 |
|------|-----------|------|
| `error` | **mm_logs (DB) + 콘솔** | 데이터 손실·실패. 반드시 남김 |
| `warn`  | **mm_logs (DB) + 콘솔** | 비정상이지만 복구된 상황 |
| `info` / `debug` | 콘솔만 (Vercel 런타임 로그) | 흐름 추적 |

- **클라이언트**: [lib/logger.ts](lib/logger.ts) — `logError/logWarn/logInfo/logDebug`. error/warn은 `navigator.sendBeacon`으로 `/api/logs`에 전송(페이지 이탈 중에도 보장).
- **서버(API 라우트)**: [lib/logger-server.ts](lib/logger-server.ts) — `logServer(level, event, ctx)` / `logErrorServer`. service role로 mm_logs에 직접 insert.
- 로거는 **절대 throw하지 않음** — 로깅 실패가 앱 동작을 막지 않는다.

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

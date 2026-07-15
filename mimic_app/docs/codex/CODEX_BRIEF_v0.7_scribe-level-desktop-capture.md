# CODEX_BRIEF_v0.7 — Parro Desktop Capture를 Scribe 수준에 가깝게 재설계/개선

> 작성자: MAX / CoMind Works Development Lead Agent  
> 작성일: 2026-07-16  
> 프로젝트: Parro — 기존 MIMIC  
> 목적: 현재 “전체화면 스크린샷” 수준의 Desktop Capture를 Scribe에 가까운 클릭 기반 매뉴얼 자동 생성 UX로 개선  
> 중요도: 매우 높음 — Parro의 핵심 제품 가치와 직접 연결됨

---

## 0. Codex에게 주는 핵심 결론

현재 Parro Desktop Capture는 제품 기준에 미달이다.

정호님의 요구는 “스크린샷 기능을 조금 개선”하는 것이 아니라, **Scribe를 벤치마킹한 데스크톱 워크플로우 캡처 경험**을 구현하는 것이다.

```text
Desktop Capture = Scribe-like click-driven workflow recording
```

v0.7의 성공 기준은 다음이다.

```text
사용자가 Desktop Recording을 시작한 뒤 데스크톱 앱/웹/OS 화면에서 클릭하면,
클릭한 화면만 자동 캡처되고,
클릭 위치가 하이라이트로 표시되며,
캡처된 step이 Parro 사이드 패널에 즉시 쌓이고,
완료 버튼을 누르면 자동으로 매뉴얼 생성/편집 화면으로 이동한다.
```

이 기준을 만족하지 못하면 구현 완료로 보고하지 말 것.

---

## 1. 먼저 읽을 파일

이 저장소에는 `AGENTS.md`가 없을 수 있다. 없으면 `CLAUDE.md`를 프로젝트 작업 규칙으로 사용한다.

반드시 먼저 읽을 것:

```text
CLAUDE.md
DEV_PROCESS.md
README.md
LOCAL_TESTING.md
package.json
components/dashboard/RecordingModal.tsx
app/api/capture/finalize/route.ts
lib/validators.ts
lib/ai/capture-fallback.ts
lib/follow.ts
lib/annotations.ts
components/editor/ManualEditor.tsx
components/editor/AnnotationPreview.tsx
components/viewer/FollowStage.tsx
supabase/migrations/005_create_capture_tables.sql
supabase/migrations/021_add_element_rect_to_capture_events.sql
supabase/migrations/022_add_element_selector_to_capture_events.sql
supabase/migrations/038_add_crop_box_to_capture_events.sql
supabase/migrations/039_add_type_text_to_capture_events.sql
supabase/migrations/20260623093719_add_action_info_to_capture_events.sql
```

기존 v0.6 브리프도 참고한다.

```text
docs/codex/CODEX_BRIEF_v0.6_desktop-capture-scribe-parity.md
```

존재하지 않는 파일은 보고하고 계속 진행한다.

---

## 2. 제품 벤치마크: Scribe에서 배워야 할 핵심 UX

Scribe의 본질은 “사용자가 직접 문서를 작성하는 도구”가 아니라, **사용자의 실제 작업 과정을 자동으로 step-by-step guide로 변환하는 도구**다.

Parro가 따라가야 할 핵심 경험은 아래다.

| Scribe류 핵심 경험 | Parro Desktop Capture 요구사항 |
|---|---|
| 사용자가 녹화 시작 | Parro Desktop Recording 시작 |
| 작업 중 클릭/입력 이벤트 자동 감지 | global click 중심 이벤트 감지 |
| 이벤트마다 화면 자동 캡처 | 클릭 시 자동 step screenshot 생성 |
| 클릭 위치/대상 강조 | 클릭 하이라이트/spotlight/marker 표시 |
| 캡처된 step이 옆 패널에 쌓임 | Parro side panel에 썸네일 즉시 추가 |
| 완료하면 자동 문서 생성 | finalize 후 manual 생성/편집 화면 자동 이동 |
| 사용자는 후편집만 함 | 생성된 step 제목/설명/이미지/하이라이트를 편집 |

절대 착각하지 말 것:

```text
Desktop Capture != 전체 화면 screenshot 버튼
Desktop Capture == click-driven workflow recorder
```

---

## 3. 현재 문제 정의

정호님이 지적한 현재 문제:

```text
지금 수준은 그냥 전체화면 스크린샷 찍는 수준 밖에 안 된다.
듀얼 모니터를 쓰더라도 클릭한 화면만 나와야지 양쪽 화면을 스크린샷 하는 건 완전히 잘못됐다.
캡처가 끝나고 완료를 누르면 자동으로 매뉴얼 제작 화면으로 넘어가서 자동 매뉴얼 생성도 되어야 한다.
```

현재 상태가 아래 중 하나라면 모두 실패다.

```text
❌ 전체 virtual desktop을 한 장으로 캡처
❌ 듀얼 모니터 양쪽이 한 이미지에 들어감
❌ 클릭한 위치가 하이라이트되지 않음
❌ 클릭할 때마다 step preview가 쌓이지 않음
❌ 완료 후 사용자가 수동으로 매뉴얼 생성 화면을 찾아가야 함
❌ Desktop UX가 Web Recorder와 완전히 다름
```

---

## 4. v0.7 범위

### 4.1 반드시 구현할 것

1. Desktop Recording 시작/중지 상태를 명확하게 구현한다.
2. 클릭 이벤트를 기준으로 step을 생성한다.
3. 클릭한 display만 캡처한다.
4. 클릭한 화면만 캡처한다.
5. 듀얼 모니터 전체를 합친 screenshot을 저장하지 않는다.
6. 클릭 좌표를 캡처 이미지 기준 좌표로 변환한다.
6. 캡처 이미지 또는 step annotation에 클릭 하이라이트를 표시한다.
7. 녹화 중 side panel에 step thumbnail이 즉시 추가된다.
8. 완료 버튼 클릭 시 finalize API를 호출한다.
9. finalize 성공 후 생성된 manual/editor URL로 자동 이동한다.
10. 자동 매뉴얼 생성 상태가 사용자에게 보인다.
11. OS 권한이 없을 때 “권한이 필요하다”는 안내를 표시한다.
12. 구현 후 실제 검증 결과를 남긴다.

### 4.2 가능하면 구현할 것

1. 클릭한 앱/윈도우 영역 crop
2. 앱 이름/window title 저장
3. 입력 이벤트/type text step 저장
4. undo/delete step
5. 너무 빠른 연속 클릭 debounce
6. 자동 제목 생성: “Click Settings”, “Open File menu” 같은 액션 추정

### 4.3 이번 범위에서 하지 말 것

```text
❌ production Supabase 쓰기
❌ dev/prod env wiring 변경
❌ DB migration을 사용자 승인 없이 추가
❌ 앱 전체 리브랜딩
❌ API route/DB table/package/repo 이름 변경
❌ unrelated UI 리팩토링
❌ 전체 구조를 Electron/Tauri로 갈아엎기
❌ blind search-replace
```

---

## 5. 권장 아키텍처

현재 repository는 Next.js 웹앱 중심이며 `package.json` 기준으로 Electron/Tauri dependency가 확인되지 않을 수 있다. 따라서 Codex는 먼저 실제 Desktop 앱 코드가 어디 있는지 찾아야 한다.

검색 명령 예시:

```bash
grep -R "desktopCapturer\|screen.getAllDisplays\|globalShortcut\|getDisplayMedia\|screenshot\|recording\|recorder\|finalize" -n \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=.git \
  .
```

Hermes/Codex 환경에서는 `rg` 사용 가능하면 `rg`를 써도 된다.

### 5.1 만약 Desktop runtime 코드가 이미 있다면

기존 runtime 안에 다음 계층을 만든다.

```text
Desktop Capture Controller
  - recording state
  - permission check
  - global click listener
  - display detection
  - screenshot capture
  - crop/coordinate transform
  - event upload
  - side panel update bridge
```

### 5.2 만약 Desktop runtime 코드가 없다면

새 기능을 무리하게 완성했다고 주장하지 말고, 아래 둘 중 하나로 진행한다.

A. 현재 웹앱에서 가능한 범위:

```text
getDisplayMedia 기반 화면 선택/녹화 fallback
단, 이 방식은 global desktop click 감지가 제한될 수 있음을 명확히 보고
```

B. Desktop wrapper 필요 브리프 생성:

```text
Electron/Tauri desktop bridge가 필요함
desktopCapturer/screen/global mouse hook 또는 OS API 필요
```

그래도 v0.7 구현에서는 최소한 **웹앱 내부 recording side panel, step preview, finalize→editor 자동 이동**은 구현한다.

---

## 6. 상세 구현 요구사항

### 6.1 Recording session state

필요 상태:

```ts
type DesktopRecordingStatus =
  | 'idle'
  | 'checking-permission'
  | 'recording'
  | 'finalizing'
  | 'generating-manual'
  | 'completed'
  | 'error';
```

Recording UI에는 다음이 보여야 한다.

```text
- 현재 녹화 중 여부
- 캡처된 step 개수
- 마지막 캡처 시각
- 권한 오류/캡처 오류
- 완료 버튼
- 취소 버튼
```

### 6.2 Display detection

듀얼 모니터 규칙은 절대 조건이다.

```text
global click point가 포함된 display bounds를 찾는다.
그 display만 screenshot/crop 대상으로 삼는다.
```

의사 코드:

```ts
function findDisplayForPoint(point, displays) {
  return displays.find(d =>
    point.x >= d.bounds.x &&
    point.x < d.bounds.x + d.bounds.width &&
    point.y >= d.bounds.y &&
    point.y < d.bounds.y + d.bounds.height
  );
}
```

좌표 변환:

```ts
const localX = clickGlobalX - display.bounds.x;
const localY = clickGlobalY - display.bounds.y;
const clickXPct = (localX / captureWidth) * 100;
const clickYPct = (localY / captureHeight) * 100;
```

주의:

```text
macOS/Windows에서 display scaleFactor가 다를 수 있다.
Retina/HiDPI 환경에서는 physical pixel과 logical coordinate 변환을 확인한다.
```

### 6.3 Screenshot capture

우선순위:

1. 클릭한 앱 window crop
2. 클릭한 display 전체
3. 사용자가 선택한 source에서 클릭 display 영역 crop

금지:

```text
전체 virtual desktop 이미지를 그대로 저장하지 말 것.
```

어쩔 수 없이 full virtual desktop source만 얻을 수 있으면, 반드시 클릭 display bounds로 crop한 이미지만 step screenshot으로 저장한다.

### 6.4 Click highlight

하이라이트는 이미지 자체에 bake-in하거나 annotation으로 저장할 수 있다.

권장: 기존 annotation 시스템을 재사용한다.

```ts
{
  type: 'spotlight' | 'marker' | 'recorderBox',
  x1: clickXPct - 2,
  y1: clickYPct - 2,
  x2: clickXPct + 2,
  y2: clickYPct + 2,
  color: '#6366F1'
}
```

사용자 눈에는 다음처럼 보여야 한다.

```text
- 클릭한 지점에 원형 하이라이트/ripple
- thumbnail에서도 위치가 보임
- editor/viewer에서도 유지됨
```

### 6.5 Step preview side panel

녹화 중 UI는 최소 아래 구조를 가진다.

```text
┌──────────────────────────────┐
│ Recording...                 │
│ 7 steps captured             │
│ [완료] [취소]                │
├──────────────────────────────┤
│ Step 1  [thumbnail + marker] │
│ Step 2  [thumbnail + marker] │
│ Step 3  [thumbnail + marker] │
└──────────────────────────────┘
```

필수 동작:

- 클릭 직후 optimistic preview가 추가된다.
- 업로드/저장 중이면 loading indicator를 보여준다.
- 실패하면 해당 step에 실패 상태와 retry/remove UI를 보여준다.
- 사용자가 완료하기 전까지 step order가 유지된다.

### 6.6 Finalize and automatic manual generation

완료 버튼 클릭 시 흐름:

```text
setStatus('finalizing')
POST /api/capture/finalize with session_id and step_numbers
receive manual/tutorial id or URL
setStatus('generating-manual') if generation is async
router.push('/manual/[id]/editor') or current editor route
show generated manual
```

성공 조건:

```text
완료 버튼을 누른 뒤 사용자가 별도로 매뉴얼 생성 버튼을 찾아 누르지 않는다.
```

기존 route가 다른 URL을 반환하면 그 구조를 사용한다. 임의로 새 URL 체계를 만들지 말 것.

---

## 7. 데이터 모델 요구사항

기존 DB 컬럼으로 처리 가능한지 먼저 확인한다. 새 migration이 필요하면 보고 후 대기한다.

가능하면 capture event 또는 step에 아래 정보를 저장한다.

```text
session_id
step_number
source_type: desktop
screenshot_url
click_x_pct
click_y_pct
action_type: click
action_label optional
source_display_id optional
source_display_bounds optional
capture_bounds optional
click_global_x optional
click_global_y optional
app_name optional
window_title optional
annotations optional
created_at
```

중요:

```text
click_x_pct / click_y_pct는 캡처된 이미지 기준이어야 한다.
virtual desktop 전체 기준 좌표를 그대로 저장하면 안 된다.
```

---

## 8. 구현 단계

### Phase 1 — Audit and current-state map

1. `CLAUDE.md`, `DEV_PROCESS.md`, `package.json` 확인
2. recording/capture/finalize 관련 파일 검색
3. Desktop runtime 존재 여부 확인
4. 현재 capture event 저장 구조 확인
5. 결과를 작업 로그에 짧게 남김

완료 보고:

```text
Desktop runtime found: yes/no
Current capture entry points:
Current finalize route:
Current editor route:
Current limitations:
```

### Phase 2 — Shared capture model

1. Desktop capture step 타입 정의
2. display/click/capture coordinate helper 작성
3. helper 단위 테스트 작성
4. dual monitor bounds 테스트 작성

테스트해야 하는 케이스:

```text
- 왼쪽 display: x=0..1919
- 오른쪽 display: x=1920..3839
- 오른쪽 display 클릭 x=2500 → 오른쪽 display 선택
- localX=580으로 변환
- clickXPct 정상 계산
```

### Phase 3 — Capture UI side panel

1. RecordingModal 또는 해당 recorder UI에 side panel 추가
2. step thumbnail list 추가
3. click highlight overlay preview 추가
4. loading/error/retry/remove 상태 추가
5. 완료 버튼 상태 전환 구현

### Phase 4 — Desktop click capture integration

1. desktop bridge가 있으면 global click listener 연결
2. click event → display detection → screenshot/crop → upload/save 연결
3. desktop bridge가 없으면 가능한 fallback 구현 및 blocker 명시
4. 캡처 이미지에 click highlight/annotation 연결

### Phase 5 — Finalize → manual editor 자동 이동

1. 완료 버튼에서 finalize 호출
2. finalize response에서 manual id/tutorial id 확인
3. editor route로 router push
4. 생성 중/실패 상태 처리
5. 수동으로 다시 찾아가야 하는 UX 제거

### Phase 6 — Verification

1. unit test 가능한 helper 테스트
2. lint/build 실행
3. manual desktop test 수행
4. 듀얼 모니터 테스트 결과 보고

---

## 9. 권장 테스트

### 9.1 Unit tests

가능하면 아래 helper 테스트를 만든다.

```text
findDisplayForPoint(point, displays)
toLocalDisplayPoint(point, display)
toPercentPoint(localPoint, captureSize)
clampPercentPoint(point)
buildClickHighlightAnnotation(clickXPct, clickYPct)
```

### 9.2 Manual QA script

Codex는 구현 후 아래 수동 테스트 절차를 수행하거나, 수행 불가 시 이유를 명확히 남긴다.

```text
1. Parro local dev 실행
2. Desktop Recording 시작
3. 왼쪽 모니터에서 앱 A 클릭
4. side panel에 step 추가 확인
5. step thumbnail에 왼쪽 모니터만 보이는지 확인
6. 클릭 위치 하이라이트 확인
7. 오른쪽 모니터에서 앱 B 클릭
8. side panel에 step 추가 확인
9. step thumbnail에 오른쪽 모니터만 보이는지 확인
10. 양쪽 모니터가 한 이미지에 합쳐지지 않았는지 확인
11. 완료 버튼 클릭
12. 자동으로 manual editor 이동 확인
13. 생성된 manual에 step 이미지/하이라이트 표시 확인
```

### 9.3 Commands

실행 가능한 명령을 package.json 기준으로 확인한다.

기본 후보:

```bash
npm run lint
npm run build
```

`typecheck` script가 없으면 있다고 주장하지 말 것. 필요하면 `npx tsc --noEmit` 가능 여부를 확인하고 실행한다.

---

## 10. 완료 보고 형식

반드시 아래 형식으로 보고한다.

```text
1. 읽은 파일
2. Desktop runtime 존재 여부
3. 변경 파일
4. 구현한 UX
5. 클릭한 display만 캡처하는 방식
6. click coordinate 변환 방식
7. click highlight 구현 방식
8. side panel preview 구현 방식
9. finalize → manual editor 자동 이동 방식
10. 실행한 테스트/검증 명령과 실제 출력
11. 수동 QA 결과
12. 미검증 항목과 이유
13. 남은 blocker / 다음 작업
```

---

## 11. MAX의 품질 기준

아래 중 하나라도 해당하면 완료로 보지 않는다.

```text
❌ “일단 전체화면 캡처는 됩니다”
❌ “듀얼 모니터는 나중에 보겠습니다”
❌ “완료 후 사용자가 직접 이동하면 됩니다”
❌ “패널 preview 없이 나중에 결과만 보면 됩니다”
❌ “하이라이트는 editor에서 수동으로 넣으면 됩니다”
```

이번 작업은 Parro가 Scribe류 제품으로 보일 수 있는지 가르는 핵심 품질선이다.

최소 기준은 다음이다.

```text
클릭 → 해당 화면 캡처 → 하이라이트 → 패널에 step 추가 → 완료 → 자동 매뉴얼 생성/편집 이동
```

이 흐름이 끊기면 제품적으로 실패다.

# 라이브 가이드 강화 방안 보고서

작성 기준: `origin/main` `0a0877e`, 2026-07-05 KST  
확인 범위: `mimic_app` 웹앱, `mimic_recorder` 확장, Live Guide 관련 API/오버레이 코드

## 0. 요약

현재 라이브 가이드는 코드 구조상 실행 가능한 상태다. 웹앱의 실행 버튼이 확장 프로그램으로 `START_GUIDE` 메시지를 보내고, 확장은 `/api/guide/[token]`에서 스텝을 받아 실제 페이지 위에 오버레이를 띄우는 흐름을 갖고 있다.

다만 “빌드가 된다”와 “실제 사용자 환경에서 안정적으로 끝까지 수행된다”는 별개다. 이번 확인에서는 앱 빌드와 recorder JS 구문 검사는 통과했지만, 설치된 Chrome 확장 프로그램으로 실제 사이트에서 끝까지 수행하는 E2E는 실행하지 못했다. 따라서 제품 판단은 `동작 가능 / 실기 검증 필요`로 보는 것이 맞다.

가장 먼저 고칠 버그는 `/api/play/[token]` 응답에 `follow_config`, `step_type`, `type_text`가 빠져 공유 학습 가이드가 스튜디오 보정값을 반영하지 못할 수 있는 문제다. 라이브 가이드 본 API(`/api/guide/[token]`)는 별도 payload를 쓰므로 직접 실행 경로는 상대적으로 안전하지만, 학습 가이드와 라이브 가이드가 같은 설정을 쓴다는 제품 약속이 흔들린다.

## 1. 현재 라이브 가이드 핵심 기능 동작 여부

| 기능 | 상태 | 근거 | 비고 |
| --- | --- | --- | --- |
| 웹앱 실행 진입 | 통과 | `lib/api/liveGuide.ts`의 `startLiveGuide()`가 `NEXT_PUBLIC_EXTENSION_ID`로 `START_GUIDE` 외부 메시지 전송 | 확장 설치/활성화, `externally_connectable` 도메인 매칭 필요 |
| 공유 뷰 실행 | 통과 | `app/play/[token]/page.tsx`에서 버튼 클릭 및 `mode=live` 자동 실행 지원 | 확장 미설치 시 안내 alert |
| 스튜디오 저작/미리보기 | 부분 통과 | `app/manual/[id]/studio/page.tsx`가 `follow_config` 저장 및 `FollowStage` 기반 학습 가이드 미리보기 제공 | 실제 라이브 오버레이와 1:1 WYSIWYG는 아님 |
| Guide API | 통과 | `app/api/guide/[token]/route.ts`가 public share token과 owner preview UUID를 분리하고, `follow_config`, `type_text`, selector/xpath/좌표/audio/survey payload 반환 | owner preview 인증 방식은 강화 권장 |
| 무료 한도/과금 게이트 | 통과 | `consume_free_live_guide_run` RPC로 public 실행 시 free 누적 5회 원자적 차감 | DB migration 적용 상태는 별도 운영 확인 필요 |
| Recorder 시작 플로우 | 통과 | `mimic_recorder/background.js`가 `START_GUIDE`에서 token 검증, API fetch, side panel open, content script 주입, overlay 표시 수행 | 실제 Chrome 확장 reload 후 E2E 필요 |
| Overlay 렌더링 | 통과 | `guide-engine.js`가 selector, XPath, fuzzy, manual hotspot, coordinate fallback, waiting UI, AI reground를 처리 | AI reground는 extension session token이 있는 경우에만 동작 |
| 단계 이동/종료 | 통과 | `GUIDE_NEXT`, `GUIDE_PREV`, `SHOW_OVERLAY_FOR_STEP`, `EXIT_GUIDE`, `GUIDE_VALIDATE`, tab close cleanup 존재 | stale guide state 방어 코드 있음 |
| 실제 확장 E2E | 미검증 | 이번 세션에서는 installed extension + 실제 대상 사이트 실행을 하지 않음 | 출시 전 필수 확인 |

검증 결과:

- `NODE_OPTIONS=--use-system-ca npm run build` 통과
- `node --check ../mimic_recorder/background.js`
- `node --check ../mimic_recorder/content.js`
- `node --check ../mimic_recorder/guide-engine.js`
- `node --check ../mimic_recorder/popup.js`

남은 build warning은 기존 React Hook dependency 및 `<img>` 경고로, 이번 Live Guide 핵심 경로를 막는 컴파일 오류는 아니다.

## 2. 방향성 검토

### 제품 방향

라이브 가이드는 매뉴얼을 대체하는 기능이 아니라, 매뉴얼/학습 가이드 다음 단계의 실행 보조 레이어로 잡는 것이 맞다.

- 매뉴얼: 문서화, 공유, 검색, 검토의 기준점
- 학습 가이드: 캡처 화면 위에서 안전하게 따라 해보는 공개/저마찰 모드
- 라이브 가이드: 원본 사이트 위에서 실제 작업을 끝까지 수행하게 돕는 확장 기반 Beta 모드

따라서 지금 단계의 강화 우선순위는 “더 자동화된 에이전트”보다 “사용자가 길을 잃지 않는 실행 신뢰도”다. 특히 타깃을 못 찾았을 때 가짜 핫스팟을 찍지 않고, 기다림/건너뛰기/수정 유도/실패 수집으로 이어지는 흐름이 중요하다.

### 기술 방향

현재의 targeting ladder는 유지하는 것이 좋다.

1. 작성자가 보정한 `follow_config.hotspotX/Y`
2. CSS selector
3. XPath
4. fuzzy self-healing
5. element rect / click coordinate fallback
6. authenticated AI visual reground

다만 이 ladder가 제품 품질로 이어지려면 세 가지가 더 필요하다.

- 스튜디오에서 저장한 값이 학습 가이드, 공유 뷰, 라이브 가이드에 동일하게 흐르는 payload parity
- 실제 실패 데이터를 수집하는 completion/survey/reground/fallback metrics
- 확장 프로그램 reload, external message, tab navigation, SPA 지연 렌더링까지 포함한 반복 E2E

### UX 방향

라이브 가이드는 Beta 라벨을 유지하되, 사용자가 실패 원인을 이해하게 해야 한다.

- 확장 미설치: 설치/활성화 안내
- 원본 URL 없음: 라이브 실행 불가, 학습 가이드 우선 안내
- 대상 페이지 다름: 잘못된 화면 안내
- 요소 미발견: 찾는 중, 건너뛰기, 다시 녹화/핫스팟 보정 안내
- 무료 한도 초과: 제작자 기준 한도임을 명확히 설명

## 3. 버그 확인

### P1. 공유 학습 가이드가 스튜디오 보정값을 못 받을 수 있음

증상:

- `app/play/[token]/page.tsx`는 `s.follow_config`, `s.step_type`을 읽어 `toFollowSteps()`로 전달한다.
- 하지만 `app/api/play/[token]/route.ts`의 `normalizedSteps`에는 `follow_config`, `step_type`, `type_text`가 포함되어 있지 않다.
- 결과적으로 공유 학습 가이드에서 스튜디오의 숨김, `none`, 핫스팟 보정, 입력 텍스트, 말풍선 위치가 빠질 수 있다.

영향:

- 학습 가이드와 라이브 가이드가 같은 스튜디오 설정을 쓴다는 제품 일관성이 깨진다.
- 작성자는 저장됐다고 보지만 공유 사용자는 다른 안내를 볼 수 있다.

수정 방향:

- `app/api/play/[token]/route.ts`의 `normalizedSteps`에 최소 `follow_config`, `step_type`, `type_text`를 포함한다.
- 가능하면 `capture_source`, `capture_failure_reason`도 포함해 `none`/설명형 단계 처리와 디버깅을 맞춘다.
- 수정 후 `/play/[token]`에서 hidden step, manual hotspot, typeText, `kind='none'` 케이스를 확인한다.

### P1. Live Guide 음성 지원이 제품 문구/API와 실제 overlay 사이에서 어긋남

증상:

- `app/api/guide/[token]/route.ts`는 `audio_url`, `audio_start_ms`, `audio_end_ms`를 payload에 넣는다.
- 스튜디오에는 음성이 “연습 가이드와 Live Guide Beta에서만 사용”된다는 설명이 있다.
- 하지만 `mimic_recorder/guide-engine.js`는 `audio_url`을 검색/재생하지 않는다.

영향:

- 유료 TTS가 켜져 있어도 실제 Live Guide overlay에서는 음성이 나오지 않을 가능성이 높다.
- 사용자는 “Live Guide에서 음성이 나온다”는 기대를 갖지만 실제 경험은 다를 수 있다.

수정 방향:

- recorder overlay에 음성 버튼을 추가하고, 사용자 클릭 후 재생되게 한다.
- 브라우저 autoplay 제한 때문에 자동재생을 기본값으로 약속하지 않는다.
- 학습 가이드의 `voiceOn` UX와 동일한 “아바타 클릭으로 듣기 / 토글 후 자동재생” 패턴을 검토한다.

### P2. Owner preview 인증 경로는 `getSession()` 대신 검증된 claims로 통일 필요

증상:

- `/api/guide/[token]`의 UUID owner-preview 경로는 `createServerClient().auth.getSession()`으로 로그인 여부를 확인한다.
- 같은 프로젝트의 `requireAuth()`는 `getClaims()` 기반으로 검증된 user id를 사용한다.

영향:

- 현재 코드가 곧바로 취약하다고 단정할 근거는 부족하다.
- 다만 service role client로 draft tutorial을 반환하는 경로이므로 인증 판단은 프로젝트 표준인 `requireAuth()`/claims 검증으로 통일하는 편이 안전하다.

수정 방향:

- `app/api/guide/[token]/route.ts`에서 UUID path 인증을 `requireAuth(request)`로 교체한다.
- 기존 `eq('user_id', auth.userId)` 조건은 유지한다.

### P2. 실제 확장 E2E 미검증

이번 확인은 build/syntax/static audit 중심이다. 다음 항목은 실제 Chrome 확장으로 검증해야 한다.

- `/play/[token]?mode=live` 진입 시 side panel open 유지
- 첫 스텝 page_url 이동 후 countdown/overlay 표시
- selector/XPath 정상 케이스
- DOM 변경 후 fuzzy recovery
- 요소 미발견 waiting UI
- 수동 hotspot 우선순위
- type_text 자동입력/복사
- last step completion + survey submit
- tab close 후 ghost guide state 제거
- free user 5회 한도 및 gated 응답

### P3. 중복/레거시 설문 코드 정리 필요

`app/play/[token]/page.tsx`에는 기존 `SurveyModal` 계열 코드와 새 `FeedbackSurveyModal`이 함께 남아 있다. 현재 동작을 막는 버그는 아니지만, 설문 경로가 늘어나면서 유지보수 혼선을 만든다.

수정 방향:

- 실제 사용 중인 `FeedbackSurveyModal`만 남기고 미사용 `SurveyModal`, `SurveyState`, 관련 helper를 제거한다.
- 제거 전 `/play/[token]` build와 manual viewer survey 표시를 확인한다.

## 4. 강화 우선순위

1. Payload parity fix  
   `/api/play/[token]` 응답에 `follow_config`, `step_type`, `type_text`를 포함해 학습 가이드와 라이브 가이드 설정을 맞춘다.

2. Real extension E2E  
   dev/prod 각각에서 실제 확장 reload 후 `/play/[token]?mode=live` 전체 흐름을 검증한다.

3. Live Guide 음성 UX 결정  
   자동재생을 약속하지 말고, 클릭 기반 재생 UX로 먼저 넣는다.

4. Owner preview auth hardening  
   UUID owner-preview 경로를 `requireAuth()` 기반으로 통일한다.

5. Failure analytics  
   `waiting`, `wrong_page`, `reground_success/fail`, `manual_skip`, `completion`, `survey_issue`를 수집해 다음 개선 기준으로 삼는다.

6. Copy 정리  
   사용자 노출 문구는 “라이브 가이드 Beta”를 기본으로 하고, 기술 식별자만 `LiveGuide`/`liveGuide`를 유지한다.

## 5. 결론

라이브 가이드는 현재 “기능 뼈대가 있다” 수준을 넘어, 실제 실행을 위한 웹앱-API-확장 연결이 구성되어 있다. 다음 단계는 새 기능 추가보다 parity, 실기 검증, 실패 처리, 피드백 수집을 먼저 다지는 것이 맞다.

강화 작업의 1순위는 공유 학습 가이드 payload 누락 수정이다. 이 문제를 먼저 잡아야 스튜디오에서 보정한 실행 의도가 학습 가이드와 라이브 가이드 전체에 일관되게 전달된다.

## 6. 2026-07-05 반영 상태

이번 작업에서 다음 항목을 코드에 반영했다.

- `/api/play/[token]` 응답에 `follow_config`, `step_type`, `type_text`, capture 상태 필드를 포함해 공유 학습 가이드와 스튜디오 설정의 parity를 맞춤
- `toFollowSteps()`가 `follow_config.typeText`가 없을 때 캡처 원문 `type_text`를 fallback으로 사용
- `/api/guide/[token]` owner-preview 인증을 `getSession()`에서 `requireAuth()` 기반 검증 claims 흐름으로 교체
- Live Guide overlay에 사용자 클릭 기반 `audio_url` 재생 버튼 추가
- Live Guide 실행 중 `enter`, `step`, `complete`, `exit` 이벤트를 기존 `/api/events`로 기록
- 설명형/대기형 마지막 단계에서 완료 버튼이 반복되지 않고 종료되도록 보정
- `/play/[token]`의 미사용 레거시 `SurveyModal` 제거
- 슬라이드 재생 속도 설정이 실제 자동재생 타이머에 반영되도록 수정

남은 확인은 실제 Chrome 확장 프로그램을 reload한 뒤 `/play/[token]?mode=live`에서 수행하는 end-to-end 실기 검증이다.

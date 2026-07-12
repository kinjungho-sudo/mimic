# 매뉴얼 텍스트 자동 완성 강화 방안 보고서

작성일: 2026-07-05
대상 워크트리: `mimic-api` / 브랜치 `feat/api`

## 작업 반영 현황

2026-07-05 현재 보고서의 권장 실행 항목 중 코드로 처리 가능한 항목은 반영했다.

| 항목 | 상태 | 반영 파일 |
| --- | --- | --- |
| `patch-steps`의 `analyzeScreenshot` 인자 순서 수정 | 완료 | `app/api/tutorials/[id]/patch-steps/route.ts` |
| AI 설명 생성의 빈/저품질 결과 저장 방지 | 완료 | `app/api/steps/[id]/generate-description/route.ts`, `lib/ai/text-quality.ts` |
| AI 재작성 API 인증/레이트리밋 강화 | 완료 | `app/api/ai/rewrite/route.ts`, `app/api/ai/rewrite-all/route.ts` |
| 공통 텍스트 품질 유틸 추가 | 완료 | `lib/ai/text-quality.ts` |
| 회귀 smoke test 추가 | 완료 | `scripts/verify-manual-text-autocomplete.js` |
| 실제 `Recorder -> capture/finalize -> manual editor` E2E | 미확인 | 실제 확장 녹화/로그인 세션 필요 |

## 전제와 검증 범위

이 보고서는 현재 로컬 코드 기준의 구조 검토와 정적/회귀 검증 결과다. 실제 브라우저 확장으로 `Recorder -> capture/finalize -> manual editor`까지 새 매뉴얼을 생성하는 end-to-end 검증은 아직 수행하지 않았다.

검증 결과:

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 자동 완성 smoke test | Pass | `node scripts/verify-manual-text-autocomplete.js` -> `{"ok":true,"checks":10}` |
| 캡처 폴백 회귀 테스트 | Pass | `node scripts/verify-capture-fallback.js` -> `{"ok":true,"cases":16,"empty_titles":0,"empty_scripts":0}` |
| 린트 | Pass with warnings | `npm run lint` 성공. 기존 React hook/img 경고만 출력 |
| 타입 검사 | Pass | `npx tsc --noEmit` 성공 |
| 빌드 | Pass with warnings | `NODE_OPTIONS="--use-system-ca" npm run build` 성공. 기존 React hook/img 경고만 출력 |
| 실제 레코더 플로우 | Not verified | 실제 녹화/저장/편집기 렌더 결과는 미확인 |

## 1. 현재 핵심 기능 동작 여부

현재 “텍스트 자동 완성”은 하나의 `autocomplete` 기능이 아니라, 아래 파이프라인으로 구현되어 있다.

| 구간 | 현재 상태 | 판정 |
| --- | --- | --- |
| 캡처 중 단일 스텝 분석 | `/api/capture/analyze`가 스크린샷, URL, 액션 정보, 클릭 좌표, 요소 영역을 `analyzeScreenshot`에 전달해 제목 후보를 만든다. | 동작 경로 있음 |
| 캡처 이벤트 저장 | `/api/capture/save-step`가 `ai_title`, `ai_description`, `action_info`, `element_text`, `type_text`, 클릭/요소 메타데이터를 저장한다. | 동작 경로 있음 |
| finalize 초안 생성 | `/api/capture/finalize`가 `mm_tutorials`, `mm_steps`를 만들고, 부족한 제목/설명을 Vision/텍스트 생성으로 보완한 뒤 `generateDraft`로 `user_title`, `user_script`를 저장한다. | 핵심 경로 구현됨 |
| 저품질 초안 폴백 | `buildCaptureFallbackDraft`, `isUsableCaptureDraft`가 `edit`, `oauth`, `general`, 숫자 라벨 같은 원시 캡처 문자열을 걸러 대체 문장을 만든다. | 회귀 테스트 통과 |
| 에디터 자동 보완 | `/manual/[id]/editor` 로드 시 설명이 비어 있는 스텝에 `/api/steps/[id]/generate-description`을 순차 호출한다. | 동작 경로 있음 |
| 수동 AI 완성 | `ManualEditor`의 `AI 완성` 버튼이 단일 스텝 설명을 생성하고 저장한다. | 동작 경로 있음 |
| 전체 문장 다듬기 | `/api/ai/rewrite-all`과 에디터 액션이 전체 스텝 설명을 지정 톤으로 재작성한다. | 동작 경로 있음 |
| 음성 기반 텍스트 | `finalize`에서 연속/스텝별 음성을 Whisper로 전사하고 `cleanTranscripts` 결과를 `user_script`에 반영한다. | 동작 경로 있음 |

판정: 핵심 자동 완성 골격은 이미 있다. 특히 “AI 실패 시에도 빈 제목/빈 설명으로 끝나지 않게 하는 폴백”은 현재 테스트로 보호된다. 다만 실제 사용자 품질을 보장하려면 현재의 API 성공 여부보다, 최종 `user_title/user_script`가 사람이 읽을 수 있는지와 에디터에서 기대한 대로 보이는지를 별도로 검증해야 한다.

## 2. 방향성 검토

권장 방향은 “완전 자동 작성기”보다 “검토 가능한 초안 작성기”다. MIMIC의 기본 가치는 매뉴얼을 없애는 것이 아니라, 실제 화면 시연을 문서 매뉴얼과 인터랙티브 연습 자료로 빠르게 전환하는 데 있다.

우선순위는 다음 순서가 적절하다.

| 우선순위 | 방향 | 이유 |
| --- | --- | --- |
| 1 | `capture/finalize` 품질 게이트 강화 | 사용자가 처음 보는 결과가 여기서 결정된다. 실패하면 에디터 보정 비용이 커진다. |
| 2 | 스텝별 컨텍스트 패키지 표준화 | `action_type`, `action_label`, `element_text`, URL/domain, 이전/다음 스텝, no-action 여부를 모든 생성 경로에서 같은 형태로 쓰면 품질 편차가 줄어든다. |
| 3 | 저품질 판정 공통화 | 현재 폴백 검사는 finalize 중심이다. `generate-description`, `rewrite-all`, 제목 재생성에도 같은 품질 규칙을 적용해야 한다. |
| 4 | 에디터 UX를 “재작성/적용/되돌리기” 중심으로 정리 | 자동 생성이 틀렸을 때 사용자가 원문을 잃지 않고 빠르게 고칠 수 있어야 한다. |
| 5 | 교육/연습 모드 프롬프트 분리 | 교육 피벗 관점에서는 단순 “클릭합니다”보다 “왜 이 화면을 쓰는지”를 설명하는 학습형 문장이 필요하다. |

구체 강화안:

| 영역 | 개선안 |
| --- | --- |
| 생성 입력 | 모든 AI 생성 호출에 `StepTextContext` 같은 공통 입력 모델을 둔다. 필드: `step_number`, `content_mode`, `page_url`, `domain_name`, `action_type`, `action_label`, `element_text`, `type_text`, `noAction`, `previous_title`, `next_title`. |
| 제목 생성 | “행동형 제목”과 “화면 확인형 제목”을 분리한다. 클릭 좌표나 유효 selector가 없는 스텝은 `클릭` 대신 `화면 확인`, `페이지 이동`, `설정 화면 확인` 계열로 제한한다. |
| 설명 생성 | 설명은 `user_script` 최종 후보 기준으로 1-2문장, 사용자가 그대로 따라할 수 있는 명령형을 기본값으로 한다. 교육 모드에서는 “기능 목적 + 수행 행동” 2문장까지 허용한다. |
| 품질 게이트 | 빈 문자열, 원시 라벨, 숫자 라벨, 날짜형 제목, 너무 일반적인 `화면 확인`, 특정 상품명/개인정보 포함 여부를 공통 검사한다. |
| 폴백 | AI 실패 시 “무조건 빈 값”이 아니라 도메인/URL/액션 정보 기반의 읽을 수 있는 문장을 저장한다. |
| 사용자 경험 | 자동 작성 중/실패/품질 낮음 상태를 에디터에 표시한다. 단일 스텝 `AI 완성`, 전체 `톤 다듬기`, 원문 복구를 명확히 분리한다. |
| 검증 | 회귀 테스트를 `capture-fallback`에서 `finalize draft`, `generate-description`, `rewrite-all`까지 확장한다. |

## 3. 버그 확인

### P1. `patch-steps`의 `analyzeScreenshot` 인자 순서 오류

상태: 수정 완료.

위치: `mimic_app/app/api/tutorials/[id]/patch-steps/route.ts`

현재 호출:

```ts
const { title } = await analyzeScreenshot(b64, mediaType, step.page_url);
```

문제:

- `analyzeScreenshot` 시그니처는 `base64Image, pageUrl, actionInfo?, elementContext?, mediaType?` 순서다.
- 현재 코드는 `mediaType`을 `pageUrl` 자리에 넣고, `step.page_url`을 `actionInfo` 자리에 넣는다.
- 결과적으로 빈 제목 보완 시 도메인/URL 컨텍스트가 잘못 들어가고, 액션 정보도 사라진다.
- `tsc --noEmit`은 통과했지만 Supabase 반환 타입이 넓게 잡혀 정적 검사로 잡히지 않는다.

권장 수정:

```ts
const { title } = await analyzeScreenshot(
  b64,
  step.page_url ?? '',
  undefined,
  undefined,
  mediaType
);
```

추가로 `patch-steps`에서도 `action_info`, `element_text`, `click_x/y`를 조회해 `finalize`와 같은 컨텍스트를 넘기는 편이 좋다.

### P1. AI 키 누락/빈 응답 시 에디터가 성공처럼 처리할 수 있음

상태: 수정 완료.

위치: `mimic_app/app/api/steps/[id]/generate-description/route.ts`, `mimic_app/lib/ai/claude.ts`

현재 흐름:

- `generateStepDescription`은 `ANTHROPIC_API_KEY`가 없으면 빈 문자열을 반환한다.
- route는 빈 문자열이어도 `ai_description`에 저장하고 `200 { description: "" }`을 반환한다.
- 에디터 입장에서는 “실패”와 “빈 결과”를 구분하기 어렵다.

권장 수정:

- 키 누락은 `503`, AI 오류는 `502`, 빈 결과는 `422` 또는 `{ ok:false, reason }`로 분리한다.
- 빈 설명은 DB에 저장하지 않는다.
- 자동 생성 UI에 실패 상태를 표시한다.

### P2. AI 재작성 API의 인증/비용 보호가 약함

상태: 수정 완료.

위치: `mimic_app/app/api/ai/rewrite/route.ts`, `mimic_app/app/api/ai/rewrite-all/route.ts`

현재 흐름:

- 세션 확인은 `getSession()` 기반이다.
- `/api/ai/rewrite-all`은 텍스트를 직접 받아 재작성하고, 실제 스텝 접근 권한은 이후 `updateStep` 저장 단계에서만 검증된다.
- DB를 직접 수정하지는 않지만, 인증된 사용자가 임의 텍스트로 AI 비용을 발생시킬 수 있다.

권장 수정:

- 기존 auth 패턴과 맞춰 `requireAuth` 또는 서버 검증 기반으로 통일한다.
- `rateLimitAi`를 적용한다.
- 가능하면 step id를 받아 서버에서 접근 권한을 확인한 뒤 현재 `user_script`를 읽어 재작성한다.

### P2. 자동 설명 생성과 전체 재작성의 품질 게이트가 분리되어 있음

상태: 수정 완료.

현재 `capture/finalize`에는 저품질 제목/설명 필터와 폴백이 있지만, `generate-description`과 `rewrite-all`은 결과 문자열을 그대로 반환/저장한다.

영향:

- 단일 스텝 AI 완성에서 너무 일반적인 설명이 저장될 수 있다.
- 전체 재작성에서 특정 상품명, 원시 라벨, 너무 짧은 문장 등이 다시 들어와도 막기 어렵다.

권장 수정:

- `isLowQualityCaptureTitle`, `isLowQualityCaptureScript`를 더 일반적인 `text-quality` 유틸로 확장한다.
- 모든 생성 결과 저장 전에 공통 품질 검사를 통과시키고, 실패 시 기존 문장을 유지하거나 폴백을 사용한다.

## 권장 실행 순서

1. 완료: `patch-steps` 인자 순서 버그 수정 -> `npx tsc --noEmit`, `npm run lint`.
2. 완료: `generate-description` 빈 응답/키 누락 처리 개선 -> smoke test 추가.
3. 완료: `text-quality` 공통 유틸 추가 -> `capture-fallback` 회귀 케이스 유지.
4. 남음: 실제 `Recorder -> capture/finalize -> manual editor`로 1개 매뉴얼 생성 후, 제목/본문/에디터 표시를 Pass/Warning/Fail로 판정.
5. 부분 반영: 교육 모드 문장 프롬프트는 기존 생성 경로를 유지했고, 추가 개선은 별도 제품 기준이 필요하다.

## 결론

현재 자동 완성의 기반은 충분히 있고, 코드 레벨에서 확인된 주요 결함은 수정했다. 다음 확인의 핵심은 실제 확장 녹화 결과가 `capture/finalize`를 거쳐 에디터에서 사람이 읽을 수 있는 제목/본문으로 보이는지 검증하는 것이다.

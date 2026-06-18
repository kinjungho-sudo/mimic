# Recorder 작업 프롬프트 — 캡처 단계에서 "하이라이트 확대 영역" 결정 (Tango식)

> 이 문서를 코딩 에이전트에게 그대로 전달하세요. MIMIC Recorder(Chrome 확장, `mimic_recorder/`)에서 작업합니다.
> **웹앱 쪽 수신부는 이미 구현·배포되어 있습니다.** 이 프롬프트는 Recorder가 보낼 데이터만 추가하면 됩니다.

## 배경 / 현재 동작
- 지금은 Recorder가 클릭마다 **전체 뷰포트 스크린샷(JPEG)** 을 Supabase Storage에 올리고, 메타데이터를 `POST /api/capture/save-step` 으로 보냅니다.
- 확대(줌)는 **웹 서버가 finalize 단계에서 `element_rect`로 휴리스틱 계산**해 적용했습니다. 즉 "확대 영역 결정"이 웹에 있었습니다.
- 목표: **확대 영역(하이라이트 박스) 결정을 캡처 단계(Recorder)로 옮긴다.** Recorder가 클릭한 요소의 실제 bounding box를 알고 있으므로, 캡처 시점에 확대 영역(`crop_box`)을 계산해 보내고, 웹은 그 영역으로 확대 프레이밍을 적용한다.

## 핵심 설계 결정 (반드시 지킬 것)
1. **이미지를 물리적으로 자르지 않는다.** 전체 스크린샷을 지금처럼 그대로 업로드한다(원본 보존 → 편집기에서 "원본/전체"로 되돌리기 가능).
2. **`element_rect`, `click_x`, `click_y` 는 지금처럼 원본 뷰포트 기준 0~1 로 계속 보낸다.** (라이브 가이드의 실제 페이지 요소 탐지·따라하기 핫스팟·어노테이션이 모두 이 좌표를 쓰므로 절대 좌표계를 바꾸지 말 것.)
3. **새 필드 `crop_box` 하나만 추가로 보낸다** — 원본 이미지 기준 0~1 정규화 `{x, y, width, height}`. 웹이 이걸 `image_zoom`/offset 프레이밍으로 변환해 모든 화면(편집기·뷰어·슬라이드)에서 일관 확대한다.

## 구현 위치 (background.js)
- `prepareCapture(...)` (대략 background.js:1793~1814) — 이 시점에 JPEG와 `stepData.elementRect`(0~1), 정규화된 `clickX/clickY`(0~1)가 모두 scope에 있다. 여기서 `crop_box`를 계산한다.
- `saveStep(payload)` 페이로드 (대략 background.js:1998~2024) — 여기에 `crop_box`를 추가한다.

## 추가할 코드

### 1) crop_box 계산 함수 (background.js 상단 유틸 근처에 추가)
```js
// 클릭 요소(elementRect, 0~1) 기준으로 캡처 단계 확대 영역을 계산한다(Tango식 프레이밍).
// 반환: 원본 이미지 기준 0~1 {x,y,width,height}, 또는 null(요소 없음 → 확대 안 함).
// 주의: 이미지를 자르는 게 아니라 "확대해서 보여줄 영역"을 정의하는 메타데이터다.
function computeCropBox(elementRect, clickX, clickY) {
  if (!elementRect) return null;
  const size = Math.max(elementRect.width, elementRect.height);
  // 요소가 작을수록 더 넓은 패딩(컨텍스트 확보), 클수록 좁게
  const PAD = size < 0.05 ? 0.15 : size > 0.3 ? 0.05 : 0.10;
  const MIN_W = 0.35;   // 너무 작게 확대돼 글씨가 깨지지 않도록 최소 영역 보장
  const MIN_H = 0.25;
  // 확대 중심: 클릭 지점 우선, 없으면 요소 중심
  let cx = elementRect.x + elementRect.width / 2;
  let cy = elementRect.y + elementRect.height / 2;
  if (clickX > 0 && clickY > 0) { cx = clickX; cy = clickY; }
  const w = Math.max(elementRect.width + PAD * 2, MIN_W);
  const h = Math.max(elementRect.height + PAD * 2, MIN_H);
  const x = Math.max(0, Math.min(1 - w, cx - w / 2));
  const y = Math.max(0, Math.min(1 - h, cy - h / 2));
  return {
    x: Math.round(x * 1000) / 1000,
    y: Math.round(y * 1000) / 1000,
    width: Math.round(Math.min(1 - x, w) * 1000) / 1000,
    height: Math.round(Math.min(1 - y, h) * 1000) / 1000,
  };
}
```

### 2) prepareCapture 안에서 crop_box 계산
`elementRect`(0~1)와 정규화된 `clickX/clickY`(0~1, 이미 `prepareCapture`에서 `stepData.clickX / winW`로 계산 중)를 사용:
```js
// 행동 없음(이동/빈영역/요소 없음)에는 확대 영역을 만들지 않는다.
const cropBox = stepData.elementRect
  ? computeCropBox(stepData.elementRect, clickX, clickY)
  : null;
```

### 3) saveStep 페이로드에 추가
```js
{
  session_id, step_number, screenshot_url,
  click_x, click_y,            // 그대로 0~1 (원본 기준) — 변경 금지
  title, description, url,
  domain_hostname, domain_name, domain_favicon,
  viewport_w, viewport_h,
  element_selector, element_xpath,
  element_rect,                // 그대로 0~1 (원본 기준) — 변경 금지
  crop_box: cropBox,           // ★ 추가: 0~1 {x,y,width,height} 또는 null
  ...(audio_offset_ms != null ? { audio_offset_ms } : {}),
}
```

## 하지 말 것
- ❌ 스크린샷을 OffscreenCanvas로 잘라 업로드하지 말 것(이번 단계에선 전체 이미지 유지).
- ❌ `element_rect`/`click_x`/`click_y`를 잘린 좌표로 바꾸지 말 것.
- ❌ 별도 이미지(2장) 업로드 금지(이번 단계 contract는 전체 1장 + crop_box 메타).

## finalize와의 관계
- finalize 페이로드의 기존 `auto_zoom` 플래그는 그대로 둬도 된다. **웹은 스텝에 `crop_box`가 있으면 그것을 우선 적용**하고, 없으면 기존 `auto_zoom` 휴리스틱으로 폴백한다. (이중 확대 없음 — 웹에서 crop_box가 있으면 서버 휴리스틱을 건너뜀.)

## 향후(선택) — 더 똑똑한 프레이밍
Recorder는 DOM을 알고 있으므로 웹 휴리스틱이 못 하던 개선이 가능하다(이번 작업 범위 아님, 메모만):
- 버튼+옆 라벨을 함께 포함하도록 `crop_box` 확장, 입력 필드는 폼 전체를 포함 등.
- 그럴 땐 `computeCropBox`만 고도화하면 되고 contract(`crop_box` 0~1)는 그대로 유지된다.

## 검증
- `node --check background.js` 통과.
- 녹화 1회 → 네트워크 탭에서 `POST /api/capture/save-step` 바디에 `crop_box`(0~1)가 포함되는지 확인.
- 완료 후 `/manual/{id}/editor`에서 각 스텝이 클릭 요소 중심으로 확대돼 보이고, 편집기 줌 컨트롤을 100%로 내리면 전체 원본이 보이는지 확인.
- 버전 bump: `manifest.json` version +0.0.1, 스토어 zip 재생성 스크립트 사용.

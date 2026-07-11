# Parro MVP Plan

> 최종 수정: 2026-06-15

---

## 제품 라인 & 비즈니스 모델 (2026-06-15 확정)

> 유사 기능(따라하기 / Guide Me / Auto-Run)이 의미 없이 중복 생성되던 문제를 정리하고,
> 제품 구조 = 과금 구조가 1:1로 맞도록 재정의함. 상세 설계 이력은 `MIMIC_PRODUCT_DESIGN_v2.md` 참조.

### 핵심: 같은 녹화 데이터에서 출발하는 2개 제품 라인 + 그 위의 실전 모드

```
[녹화/캡처]  ← 공통 입력 (확장이 클릭·스샷·좌표·셀렉터 캡처 → DB)
    │
    ├─ ① 문서 매뉴얼 (기존 에디터)
    │     · AI 자동생성 = 거의 무편집, 세로로 읽는 업무용 문서
    │     · 뷰어: 문서뷰 / Word / 임베드 / URL (HTML)
    │     · "매뉴얼 자동화" 라인
    │
    └─ ② 인터랙티브 매뉴얼  ← 문서에서 "업그레이드"로 생성 (생성 흐름 2번)
          · Guide Me 스튜디오(신규 별도 화면)에서 저작
          · 가상 크롬 화면처럼 보이는 슬라이드 + AI 캐릭터 + 2단 툴팁(행동/설명)
          · 하이라이트·화살표·행동 유도·클릭으로 진행 (향후 대화형 챗봇)
          · 확장 불필요 — 모든 브라우저/모바일에서 체험·교육 (안전: 결제·삭제도 가상)
          │
          └─ ③ Guide Me (실전, Beta)  ← 인터랙티브 매뉴얼 기반 재사용
                · "Guide me" 클릭 → 실제 페이지로 이동 + 확장이 실제 화면 위에서 같은 가이드 실행
                · 사용자가 진짜 클릭하며 따라함. 크롬 확장 전용 (차별점)
```

### 생성 흐름 (확정: 2번)
- 녹화 캡처 완료 → **문서 매뉴얼** 자동 생성(기본). → 원하면 **"인터랙티브로 만들기"** CTA로 업그레이드(= Pro 업셀 지점).
- **데이터: 단일 레코드 + 인터랙티브 레이어.** 별도 복제본을 만들지 않고, 문서 콘텐츠(제목/설명/스샷/타깃/클릭)를 공유 기반으로 두고 인터랙티브 전용 필드(행동라벨·설명 툴팁·화살표·캐릭터)를 추가로 얹는다. 인터랙티브 레이어는 문서 내용에서 시드.

### 정리된 변경 (신규/유지/은퇴)
- **은퇴**: 기존 수동 슬라이드 플레이어(passive), 매뉴얼 페이지의 iframe "Guide Me 미리보기"(대부분 사이트가 iframe 차단 → 구조적 불가), `따라하기`(FollowAlongOverlay)·`SdkPreviewPanel`의 스샷 슬라이드쇼 → 인터랙티브 매뉴얼로 흡수.
- **유지**: 문서 뷰 / Word·PDF / 임베드·URL 공유.
- **신규**: Guide Me 스튜디오(저작), 인터랙티브 플레이어(연습), Guide Me 실전(확장, 이미 엔진 구현·라이브 검증 대기).

### 비즈니스 모델 (요금제 ↔ 기능 라인)
| 티어 | 제공 | 한도 |
|------|------|------|
| **Free** | 자동 문서화 + 인터랙티브 매뉴얼(데모) | 매뉴얼 **보유 최대 5개**(문서+인터랙티브 합산), 그 중 **인터랙티브 최대 2개**. **월 생성 5회**(삭제 후 재생성도 '생성'으로 카운트). **Guide Me(실전) 미제공** |
| **Basic** | 자동 문서화 + 공유(PDF·임베드·URL) | 문서 매뉴얼 라인 전체 |
| **Pro** | + 인터랙티브 매뉴얼 + Guide Me(실전) | 핵심 차별점 |
| **Enterprise / Team (검토중)** | 전기능 + 팀 권한 관리 + 복잡 매뉴얼 통합 | 향후. **최상위 단일 Enterprise vs 직원수 기반 Team 라인 추가(+Enterprise 제거)** 중 택1 — 미확정 |

**Free 상세 규칙 (확정):**
1. **보유 캡**: 매뉴얼 5개(인터랙티브 2개). 5개를 채우면 다음 달이 되어도 **삭제 전엔 추가 생성 불가**(보유 기준, 월 리셋 아님).
2. **월 생성 캡**: 5회. 삭제→재생성도 카운트 → delete-recreate 무한 우회 방지.
3. 즉 새 매뉴얼 생성 조건 = (보유 슬롯 여유 ≤5) AND (이번 달 생성 ≤5) 둘 다 충족.
4. **Guide Me 실전(확장 오버레이)은 Free 불가** — Pro 이상.

> 협업 기능(댓글·활동로그·이메일 초대 공유·워크스페이스)은 Enterprise/Team 쪽으로 귀속(향후 확정).
> 현재 코드: `mm_users.plan` 컬럼 존재(`free`/`pro_waitlist` 등), 플랜별 한도 체크는 비활성(finalize TODO). 게이팅 enforce는 정식 출시 전 별도 작업.

---

## 전체 플로우

### 1단계 — 녹화 (mimic_recorder)

```
새 매뉴얼 만들기
  ├─ [설치됨] 녹화할 사이트 창 선택
  │           └─ 카운트 다운 → 녹화 화면으로 이동
  │                 └─ Parro Recorder 사이드 패널 자동 오픈
  │                       └─ 녹화 시작
  │                             ├─ 커서 움직임 감지 + 실시간 오버 하이라이트
  │                             ├─ 마우스 클릭 시 캡처 1회
  │                             ├─ 타이핑 실시간 추적 → 최종 텍스트만 캡처 1회
  │                             ├─ 하이라이트 위치 확대 + 클릭 하이라이트 적용
  │                             ├─ 개인정보 식별 후 자동 블러 (수동 가능)
  │                             ├─ 수동 화면 캡처
  │                             └─ 일시 정지 / 계속 녹화
  │
  │         녹화 완료 및 전송 → 캡처 DB 저장 → 사이드 패널 자동 클로즈
  │
  └─ [미설치] Parro Recorder 확장프로그램 설치 화면으로 이동
```

### 2단계 — 편집기 자동 처리 (mimic_app)

```
편집기 자동 이동 후 자동 실행:
  ├─ [✅ 구현] 제목/목차 생성 (Claude API)
  ├─ [✅ 구현] 캡처 이미지 불러오기
  ├─ [✅ 구현] 도메인 구분
  ├─ [✅ 구현] 어노테이션 적용 (미적용 된 경우만)
  ├─ [🔲 신규] 개인정보 블러 처리 (Vision API)
  └─ [🔲 신규] 중복 스텝 자동 삭제 (동일 이미지 중복)
```

### 3단계 — 수동 편집 (mimic_app)

```
수동 편집 (독립적, 어떤 순서로도 가능):
  ├─ [✅ 구현] 제목 수동 편집
  ├─ [✅ 구현] 내용 수동 편집
  ├─ [✅ 구현] 목차 수동 편집
  ├─ [✅ 구현] AI 음성 편집
  ├─ [✅ 구현] 이미지 수동 편집
  └─ [✅ 구현] 스텝 삭제 및 위치 변경
```

### 4단계 — 공유 및 내보내기 (mimic_app)

```
편집 완료 및 저장
  ├─ [✅ 구현] URL 공유 (URL / 카카오톡 / Outlook)
  │           └─ 매뉴얼 뷰어 (슬라이드/문서)
  │                 └─ PPTX/PDF 다운로드
  │
  └─ [🔲 신규] 임베드 공유 (Notion, HTML, Sharepoint)
```

---

## 기능 구현 상태

### mimic_recorder (Chrome Extension)

| 기능 | 상태 | 파일 |
|------|------|------|
| 클릭 감지 + CSS 셀렉터 추출 | ✅ | content.js |
| 실시간 커서 하이라이트 오버레이 | ✅ | content.js |
| 마우스 클릭 시 스크린샷 캡처 | ✅ | background.js |
| 타이핑 디바운스 캡처 (1.5초) | ✅ | content.js, background.js |
| PII 자동 감지 + 픽셀 블러 | ✅ | content.js, background.js |
| 수동 블러 (드래그) | ✅ | popup.js, background.js |
| 수동 화면 캡처 버튼 | 🐛 버그 | popup.js, content.js |
| 일시 정지 / 재개 | ✅ | popup.js, background.js |
| SPA 이동 감지 자동 캡처 | ✅ | content.js, background.js |
| Cross-origin 이동 감지 | ✅ | background.js |
| IndexedDB 이미지 로컬 캐시 | ✅ | background.js |
| Supabase Storage 업로드 | ✅ | background.js |
| 링크 토큰 → 세션 토큰 교환 | ✅ | background.js |
| 사이드 패널 자동 오픈/클로즈 | ✅ | background.js |

### mimic_app — 편집기 자동 처리

| 기능 | 상태 | 파일 |
|------|------|------|
| finalize → 튜토리얼 자동 생성 | ✅ | api/capture/finalize/route.ts |
| Claude Vision 제목/설명 생성 | ✅ | lib/claude.ts |
| 어노테이션 자동 생성 | 🐛 버그 | lib/annotations.ts, api/capture/finalize/route.ts |
| 도메인 구분 (favicon, hostname) | ✅ | lib/favicon.ts |
| Vision API PII 블러 처리 | 🔲 신규 | — |
| 중복 스텝 자동 삭제 | 🔲 신규 | — |

### mimic_app — 수동 편집

| 기능 | 상태 | 파일 |
|------|------|------|
| 제목 수동 편집 | ✅ | components/editor/ |
| 내용 수동 편집 | ✅ | components/editor/ |
| 목차 수동 편집 | ✅ | components/editor/ |
| AI 음성 편집 (TTS) | ✅ | api/tts/route.ts |
| 이미지 수동 편집 (드래그 블러 등) | ✅ | components/editor/ |
| 스텝 삭제 및 위치 변경 | ✅ | components/editor/ |

### mimic_app — 공유 / 내보내기

| 기능 | 상태 | 파일 |
|------|------|------|
| URL 공유 (share_token) | ✅ | api/tutorials/[id]/publish/ |
| 카카오톡 / Outlook 공유 | ✅ | components/ |
| 슬라이드 뷰어 | ✅ | app/play/[token]/ |
| 문서 뷰어 | ✅ | app/play/[token]/ |
| PDF 내보내기 | ✅ | api/export/pdf/ |
| PPTX 내보내기 | ✅ | api/export/pptx/ |
| 임베드 공유 (Notion/HTML/Sharepoint) | 🔲 신규 | — |

---

## 미해결 버그 (작업 전 반드시 확인)

> 아래 버그들은 코드가 존재하지만 실제로 동작하지 않는 상태다.
> 신규 기능 작업 전에 이것부터 수정해야 한다.

| # | 버그 | 파일 | 진짜 원인 |
|---|------|------|----------|
| A | 카운트다운 동작 안 함 | `background.js` START_RECORDING 핸들러 | `isRecording:true` 저장이 sendMessage보다 먼저 실행 → onChanged 리스너가 중복 트리거 |
| B | 배경/일부 요소 클릭 시 캡처 안 됨 | `content.js` findInteractiveTarget() | 4번째 폴백이 body/html 외 모든 요소 반환 → `!target` 브랜치 도달 불가 |
| C | 수동 캡처 버튼 무반응 | `popup.js`, `content.js` MANUAL_CAPTURE | 캡처 시 대상 탭이 비포커스 상태 → chrome.tabs.update({ active:true }) 선행 필요 |
| D | 어노테이션 이미지 위에 표시 안 됨 | `finalize/route.ts`, `AnnotationPreview.tsx` | DB user_annotations null 가능성 + SVG ref가 imgSize null 분기에만 붙어 있음 |

---

## 신규 기능 구현 순서 (우선순위)

> ⚠️ 위 미해결 버그 A~D 수정 완료 후 아래 순서로 진행

1. **중복 스텝 자동 삭제** — finalize 단계에서 동일 이미지 해시 비교
2. **Vision API PII 블러** — 편집기 진입 시 서버에서 재검사
3. **임베드 공유** — Notion embed URL + HTML iframe snippet + Sharepoint embed

---

## 반복 발생 버그 패턴 (작업 전 필독)

> 아래 패턴은 과거에 반복 발생한 실수들이다. 동일 실수 방지용.

| 패턴 | 증상 | 원인 |
|------|------|------|
| click_x/y 좌표 변환 오류 | 클릭 위치가 엉뚱한 곳 | DB는 0~10000, mm_steps는 0~1 — 변환 혼용 |
| setLoading finally 누락 | 무한 로딩 | async 함수에서 finally 없이 setLoading(false) |
| Vercel BOM 오염 | env var 앞에 이상한 문자 | env 소비 시 clean() 헬퍼 미적용 |
| DB CHECK 제약 위반 | INSERT 실패 | mode 컬럼 'guide'\|'interactive'만 허용 |
| .next 캐시 오염 | 빌드 에러 | 해결: .next 삭제 후 재빌드 |
| CJS/ESM 혼용 | import 에러 | CJS 전용 패키지는 require() 사용 |
| getUser() 호출 | 느린 응답 | middleware/auth-guard는 getSession() 사용 |
| Claude Vision media_type | 이미지 분석 실패 | image/jpeg 하드코딩 금지, content-type 동적 감지 |
| Supabase 컬럼명 오타 | 빈 배열 반환 (에러 없음) | .order() 전 컬럼명 재확인 필수 |
| storage.set → onChanged 경쟁 | 카운트다운 / 녹화 시작 중복 | storage.set 전에 sendMessage 먼저 — 순서 반드시 지킬 것 |
| findInteractiveTarget 4번째 폴백 | 빈 화면 클릭 캡처 불가 | body/html 외 모든 요소 반환 → !target 브랜치 막힘. 폴백 4 제거 |
| captureVisibleTab 탭 포커스 | 수동 캡처 무반응 | active 탭만 캡처 가능 — chrome.tabs.update({ active:true }) 선행 필수 |
| SVG ref 분기 | 어노테이션 미표시 | imgSize===null 분기에만 ref 부착 → imgSize 측정 후 ref 유실 |
| nav 캡처 중복 (2~4회) | 이동 시 같은 페이지 연속 캡처 | ① onUpdated complete가 한 이동에 여러 번 옴(리다이렉트/iframe) ② 사이트가 리사이즈에 쿼리 재작성(쿠팡 clientWidth) → SPA 감지 오발화 ③ 디덥 해시 비교가 비직렬이라 동시 캡처 둘 다 통과. 해결: origin+pathname 5초 URL 가드 + 캡처 직렬화(_captureChain) + onUpdated 탭별 busy 가드 + resize 후 쿼리만 변경 무시 |
| 도메인 그룹 분리 | 같은 서비스(쿠팡)가 여러 그룹으로 | hostname 전체(www/cart/checkout.coupang.com) 비교 금지 — baseDomain(eTLD+1)으로 그룹핑 (lib/favicon.ts baseDomain) |
| spaNavCapturing stuck | autoNav 캡처 영구 중단 | SPA 캡처 타이머의 조기 return 시 플래그 미해제 → 해제 필수 |
| 입력 스텝 분할 (한 입력이 2~3스텝) | 한 번의 타이핑이 여러 캡처로 | 리치 에디터(Gemini Quill 등)는 빈 값 전환·여러 줄 확장 시 입력 노드를 재마운트 → `typingTarget !== el`로 오판해 입력 세션 종료+새 스텝 발급. 해결: isConnected+URL로 재마운트 판정해 세션 유지 (content.js isRemountedTyping). 입력창 재클릭의 `pendingInputStep = null` 강제 리셋도 금지 |
| 타이핑 overwrite의 DB 행 폭증 | 한 입력에 mm_capture_events 행 5~8개 | save-step이 무조건 INSERT — 같은 (session_id, step_number)는 UPDATE로 갱신해야 함 (save-step upsert) |

# AGENTS.md — Parro Recorder (Chrome Extension)

## ⚠️ 작업 시작 전 필독 문서

이 프로젝트의 제품 방향, 기술 설계, 작업 원칙은 루트 문서에 정의되어 있다.
**모든 작업 전 아래 문서들을 먼저 읽어라.**

- **MVP 플로우 + 기능 현황**: `../Plan.md` — 전체 플로우, 구현 상태 체크리스트, 반복 버그 패턴
- 제품 설계서: `../MIMIC_PRODUCT_DESIGN_v2.md` — 5레이어 아키텍처, PRD, DB 스키마, 작업 원칙
- 제품 철학: `../MIMIC_WHY.md` — 타겟 고객, 문제 정의, 비전

## 이 컴포넌트의 플로우 위치

```
녹화할 사이트 창 선택
  → 카운트 다운 → Parro Recorder 사이드 패널 자동 오픈
  → 녹화 시작
      ├─ 커서 움직임 감지 + 실시간 하이라이트   (content.js)
      ├─ 클릭 시 캡처 1회                       (background.js)
      ├─ 타이핑 디바운스 캡처                    (content.js)
      ├─ PII 자동 블러                           (content.js + background.js)
      ├─ 수동 캡처 / 일시정지 / 재개             (popup.js)
      └─ SPA/Cross-origin 이동 감지 캡처        (background.js)
  → 녹화 완료 → Supabase 업로드 + /api/capture/finalize 호출
```

---

## 이 프로젝트의 역할

Chrome Extension MV3 기반 캡처 엔진 (L1 레이어).

- 사용자 클릭 이벤트 감지 → 스크린샷 캡처
- DOM 셀렉터 + 정규화 좌표 추출 (L5 AI 에이전트 대비 필수)
- Supabase Storage 업로드
- mimic_app API와 통신 (Bearer session_token)

## Git 브랜치 규칙

```
main  ←  프로덕션. 직접 커밋 금지.
dev   ←  개발 통합. 모든 작업은 여기서 시작.
```

### 커밋 메시지 규칙
- `feat:` 새 기능
- `fix:` 버그 수정
- `chore:` 설정/정리

### ⚠️ 절대 하지 말 것
- `main`에 직접 커밋
- API 키 하드코딩
- `dom_selector` 또는 `coordinates` 저장 생략

# MIMIC Guide Me — PRD v1.0

> Claude Code 제작 요청용 기능 명세서
> 작성일: 2026.06.08 | 작성: 코마인드웍스 정호

---

## 1. 개요

### 1-1. 목적
MIMIC Recorder로 캡처한 매뉴얼을 **실제 타겟 웹사이트 위에 오버레이로 재생**하여,
사용자가 "읽는" 것이 아니라 **"따라하는"** 경험을 제공한다.

### 1-2. 한 줄 정의
> *"링크 하나 보내면, 실제 앱 위에서 단계별로 안내받는다."*

### 1-3. 현재 MIMIC 개발 상태 (PRD 작성 기준)
| 항목 | 상태 |
|------|------|
| DOM 셀렉터 기반 캡처 | ✅ 완료 |
| 비전(좌표) + DOM 하이브리드 방식 | ✅ 완료 |
| 어노테이션 (박스 하이라이트) | ✅ 완료 |
| 어노테이션 (코멘트 자동 입력) | ✅ 완료 |
| Guide Me 일부 컴포넌트 | 🔲 준비됨, 미동작 |

---

## 2. 경쟁사 분석 — Guide Me 구현 방식

### 2-1. Tango Guide Me
- **방식**: Chrome Extension content script가 타겟 사이트 DOM에 오버레이 주입
- **하이라이트**: `getBoundingClientRect()`로 타겟 요소 위치 계산 → 반투명 배경 + 밝은 박스 렌더링
- **툴팁**: 단계 설명 + 다음 버튼 floating panel
- **제약**:
  - 웹 기반 워크플로우만 작동 (데스크탑 앱 불가)
  - 뷰어도 Tango 계정 + 크롬 확장 필요 → **외부 고객 공유 불가**
  - DOM 셀렉터 깨지면 가이드 실패

### 2-2. Scribe Guide Me
- **방식**: Tango와 동일 구조 (content script 기반)
- Chrome/Edge 전용, Scribe 확장 설치 필수
- 2023년 10월 이후 생성 Scribe 자동 Guide Me 활성화

### 2-3. 공통 고객 불만 (G2 리뷰 기반)
| 불만 | 내용 |
|------|------|
| **외부 공유 불가** | 계정 + 확장 요구로 고객/외주에 못 보냄 |
| **데스크탑 앱 불가** | 웹만 됨 |
| **DOM 변경 취약** | UI 업데이트 시 가이드 깨짐 |
| **편집 제한** | 실행 취소 없음, 스텝 수정 불편 |
| **음성 없음** | Tango는 TTS 미지원, 순수 텍스트만 |

### 2-4. MIMIC의 차별화 포인트
```
경쟁사 Guide Me 한계          → MIMIC 해결책
────────────────────────────────────────────────
계정 필요 (내부 전용)         → 링크만으로 외부 공유 가능
음성 없음                     → TTS 음성 안내 포함
DOM 변경에 취약               → 좌표 + DOM 듀얼 폴백
텍스트 설명만                 → 마커 + 줌인 + 클릭 애니메이션
```

---

## 3. 기능 요구사항

### 3-1. Guide Me 진입점
- 매뉴얼 뷰어 페이지 상단에 **"Guide Me" 버튼** 추가
- 버튼 클릭 시 → MIMIC 확장이 설치되어 있는 경우 Guide Me 모드 시작
- 확장 미설치 시 → 설치 유도 모달 (1클릭 웹스토어 연결)

### 3-2. Guide Me 모드 진입 흐름
```
사용자: Guide Me 클릭
  ↓
확장 설치 확인
  ↓ 설치됨
타겟 URL로 새 탭 열기 (매뉴얼 첫 번째 스텝의 capture_url)
  ↓
DOM 로드 완료 대기 (DOMContentLoaded)
  ↓
첫 번째 스텝 오버레이 렌더링
  ↓
사용자 인터랙션 → 다음 스텝
  ↓ ... 반복
마지막 스텝 완료 → 완료 메시지
```

### 3-3. 오버레이 UI 구성 요소

#### A. 배경 딤 레이어 (Backdrop)
- 전체 화면 반투명 어두운 배경 (`rgba(0,0,0,0.5)`)
- `position: fixed`, `z-index: 999998`
- 타겟 요소 위치는 밝게 뚫림 (spotlight 효과)

#### B. 하이라이트 박스 (Highlight)
- 타겟 DOM 요소를 `getBoundingClientRect()`로 위치 계산
- 요소 외곽 2px 인디고 테두리 + 밝은 배경
- 스크롤 이벤트 시 위치 재계산 (`ResizeObserver` + `scroll` 리스너)

#### C. 툴팁 패널 (Tooltip)
- 하이라이트 박스 하단 또는 상단에 floating 패널
- 포함 요소:
  - 스텝 번호 (예: `3 / 7`)
  - 스텝 설명 텍스트 (매뉴얼 comment 내용)
  - 이전 / 다음 버튼
  - X (종료) 버튼
  - 진행 바 (현재 스텝 / 전체 스텝)

#### D. TTS 음성 안내 (MIMIC 차별점)
- 스텝 진입 시 해당 스텝의 `audio_url` 자동 재생
- 음성 없는 스텝은 스킵 (선택적)
- 음소거 토글 버튼 툴팁 패널에 포함

#### E. 커서 애니메이션 (옵션)
- 타겟 요소 중앙으로 커서 이동 애니메이션
- 클릭 링 효과 (기존 플레이어의 triggerMarker 재활용)

### 3-4. 스텝 전환 로직

#### 자동 전환 (Auto-advance)
- 타겟 요소 클릭 감지 → 자동으로 다음 스텝
- 텍스트 입력 필드인 경우 → 입력 후 Enter 또는 다음 버튼으로 전환

#### 수동 전환 (Manual)
- 툴팁의 "다음" 버튼 클릭
- 키보드 단축키: `→` 다음, `←` 이전, `Esc` 종료

### 3-5. DOM 셀렉터 폴백 전략
```
1순위: DOM 셀렉터로 요소 탐색
  → 성공: getBoundingClientRect()로 위치 계산

2순위: 셀렉터 실패 시 저장된 절대 좌표 사용
  → 캡처 시 저장한 (x, y) + viewport 비율 보정

3순위: 둘 다 실패 시
  → "이 단계를 찾을 수 없습니다. 수동으로 진행해주세요." 툴팁 표시
  → 사용자가 직접 다음 버튼 클릭
```

### 3-6. 접근 방식 — 확장 vs 링크 공유
| 모드 | 요구사항 | 대상 |
|------|---------|------|
| **Guide Me (확장)** | MIMIC 확장 설치 필요 | 내부 직원, CS팀 |
| **시뮬레이션 (링크)** | 설치 불필요, 링크만 | 외부 고객, 외주 |

> ⚠️ **핵심 전략**: 외부 고객에게는 기존 시뮬레이션(스크린샷 기반) 공유,
> 내부 직원/CS팀에게는 Guide Me 제공 — 두 모드 병행

---

## 4. 기술 아키텍처

### 4-1. Content Script 구조 (Chrome Extension)

```typescript
// content_scripts/guide-me.ts

interface GuideMeStep {
  step_number: number;
  dom_selector: string;          // 기존 캡처된 셀렉터
  fallback_coords: {             // 기존 비전+DOM 좌표
    x: number;
    y: number;
    viewport_width: number;
    viewport_height: number;
  };
  comment: string;               // 툴팁 설명 텍스트
  audio_url?: string;            // TTS 음성 URL
  action_type: 'click' | 'input' | 'scroll' | 'observe';
}

class GuideMeController {
  private steps: GuideMeStep[];
  private currentIndex: number = 0;
  private overlay: GuideMeOverlay;

  async init(manualId: string) {
    // 1. Supabase에서 매뉴얼 스텝 데이터 fetch
    this.steps = await fetchManualSteps(manualId);
    // 2. 오버레이 UI 초기화
    this.overlay = new GuideMeOverlay();
    // 3. 첫 번째 스텝 렌더링
    this.renderStep(0);
  }

  private findTargetElement(step: GuideMeStep): Element | null {
    // 1순위: DOM 셀렉터
    const el = document.querySelector(step.dom_selector);
    if (el) return el;

    // 2순위: 좌표 기반 폴백
    const scaleX = window.innerWidth / step.fallback_coords.viewport_width;
    const scaleY = window.innerHeight / step.fallback_coords.viewport_height;
    const x = step.fallback_coords.x * scaleX;
    const y = step.fallback_coords.y * scaleY;
    return document.elementFromPoint(x, y);
  }

  renderStep(index: number) {
    const step = this.steps[index];
    const target = this.findTargetElement(step);

    if (!target) {
      this.overlay.showNotFound(step.comment);
      return;
    }

    const rect = target.getBoundingClientRect();
    this.overlay.render({
      rect,
      stepNumber: index + 1,
      totalSteps: this.steps.length,
      comment: step.comment,
      audioUrl: step.audio_url,
      onNext: () => this.nextStep(),
      onPrev: () => this.prevStep(),
      onClose: () => this.close(),
    });

    // 타겟 요소 클릭 감지
    if (step.action_type === 'click') {
      target.addEventListener('click', () => this.nextStep(), { once: true });
    }
  }

  nextStep() {
    if (this.currentIndex < this.steps.length - 1) {
      this.currentIndex++;
      this.renderStep(this.currentIndex);
    } else {
      this.overlay.showComplete();
    }
  }
}
```

### 4-2. Overlay 렌더링 (Shadow DOM 권장)

```typescript
// Shadow DOM 사용 이유: 타겟 사이트 CSS와 충돌 방지
class GuideMeOverlay {
  private shadowHost: HTMLElement;
  private shadow: ShadowRoot;

  constructor() {
    this.shadowHost = document.createElement('div');
    this.shadowHost.id = 'mimic-guide-me-host';
    this.shadow = this.shadowHost.attachShadow({ mode: 'closed' });
    document.body.appendChild(this.shadowHost);
  }

  render({ rect, stepNumber, totalSteps, comment, audioUrl, onNext, onPrev, onClose }) {
    this.shadow.innerHTML = `
      <style>
        /* 스타일이 타겟 사이트에 영향 없음 */
        .backdrop { position: fixed; inset: 0; z-index: 999998; }
        .highlight { position: fixed; z-index: 999999; border: 2px solid #6366f1; border-radius: 4px; }
        .tooltip { position: fixed; z-index: 1000000; background: white; border-radius: 8px; padding: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); min-width: 280px; }
        /* ... */
      </style>

      <div class="backdrop"></div>
      <div class="highlight" style="
        top: ${rect.top - 4}px;
        left: ${rect.left - 4}px;
        width: ${rect.width + 8}px;
        height: ${rect.height + 8}px;
      "></div>
      <div class="tooltip" style="${this.calcTooltipPosition(rect)}">
        <div class="step-indicator">${stepNumber} / ${totalSteps}</div>
        <p class="comment">${comment}</p>
        <div class="progress-bar"><div style="width: ${(stepNumber/totalSteps)*100}%"></div></div>
        <div class="actions">
          <button class="btn-prev">← 이전</button>
          <button class="btn-next">다음 →</button>
          <button class="btn-close">✕</button>
        </div>
      </div>
    `;

    // TTS 재생
    if (audioUrl) new Audio(audioUrl).play();

    // 이벤트 바인딩
    this.shadow.querySelector('.btn-next').addEventListener('click', onNext);
    this.shadow.querySelector('.btn-prev').addEventListener('click', onPrev);
    this.shadow.querySelector('.btn-close').addEventListener('click', onClose);
  }
}
```

### 4-3. Extension Manifest 변경 (기존에서 추가)

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content_scripts/guide-me.js"],
      "run_at": "document_idle"
    }
  ],
  "externally_connectable": {
    "matches": ["https://mimicflow.com/*"]
  }
}
```

### 4-4. DB 변경사항 (최소화)

```sql
-- mm_steps 테이블에 guide_me 관련 필드 추가 (없는 경우)
ALTER TABLE mm_steps ADD COLUMN IF NOT EXISTS
  guide_me_enabled BOOLEAN DEFAULT true;

-- mm_manuals 테이블에 guide_me 통계
ALTER TABLE mm_manuals ADD COLUMN IF NOT EXISTS
  guide_me_start_count INT DEFAULT 0,
  guide_me_complete_count INT DEFAULT 0;
```

---

## 5. UX 흐름 상세

### 5-1. 제작자(CS팀) 흐름
```
[MIMIC 대시보드] 매뉴얼 목록
  ↓ 매뉴얼 선택
[매뉴얼 상세] 공유 모달
  ↓ "Guide Me 링크 복사" 버튼 클릭
[링크 복사 완료]
  ↓ Slack / 이메일로 전달
```

### 5-2. 시청자(직원/고객) 흐름
```
[링크 클릭]
  ↓
[MIMIC 매뉴얼 페이지]
  ├── 확장 설치됨 → "Guide Me 시작" 버튼 활성화
  └── 확장 미설치 → "확장 설치 후 Guide Me 사용 가능" + 설치 링크

[Guide Me 시작 클릭]
  ↓
[타겟 사이트로 이동] (새 탭)
  ↓
[오버레이 1단계 표시]
  ↓ 클릭 / 다음 버튼
[오버레이 2단계 표시]
  ↓ ... 반복 ...
[완료 화면] "✓ 가이드 완료! 다시 보려면 클릭하세요"
```

---

## 6. 비기능 요구사항

| 항목 | 요구사항 |
|------|---------|
| **성능** | 오버레이 렌더링 100ms 이하 |
| **안정성** | DOM 셀렉터 실패율 20% 이하 (폴백 처리 포함) |
| **호환성** | Chrome 최신 3개 버전 지원 |
| **보안** | Shadow DOM으로 타겟 사이트 CSS/JS 격리 |
| **접근성** | 키보드 네비게이션 (←→ Esc) 필수 |

---

## 7. 완료 기준 (Definition of Done)

### Phase 1 (MVP Guide Me)
- [ ] Guide Me 버튼 → 타겟 URL 새 탭 열기
- [ ] DOM 셀렉터로 요소 탐색 + getBoundingClientRect 위치 계산
- [ ] Spotlight 오버레이 (딤 배경 + 하이라이트 박스) 렌더링
- [ ] 툴팁 패널 (설명 + 다음/이전/종료 버튼 + 진행 바)
- [ ] 클릭 자동 전환 (action_type: click)
- [ ] 키보드 단축키 (→ ← Esc)
- [ ] 마지막 스텝 완료 화면

### Phase 2 (강화)
- [ ] TTS 음성 자동 재생
- [ ] 좌표 폴백 (DOM 셀렉터 실패 시)
- [ ] 스크롤 대응 (요소 위치 재계산)
- [ ] 음소거 토글
- [ ] Guide Me 완료율 통계 (mm_manuals 업데이트)

---

## 8. 미결 사항 (고객 인터뷰 후 결정)

| 질문 | 인터뷰 대상 |
|------|------------|
| "없던 케이스 가이드를 실시간으로 만들어야 하는 빈도?" | 김승준(AXGATE CS팀) |
| "외부 고객에게 가이드 전달 시 확장 설치 요청 가능 여부?" | 김민성(이테크 CS팀) |
| "Guide Me vs 시뮬레이션 링크 중 어떤 게 더 자주 쓰일 것 같나요?" | 두 분 모두 |

---

## 9. 참고 — Out of Scope (이번 구현에서 제외)

- ❌ 데스크탑 앱(Electron) Guide Me (Phase 2)
- ❌ 모바일 Guide Me (Phase 3)
- ❌ 외부 공유용 설치 없는 Guide Me (기술적 한계, 중장기 검토)
- ❌ Salesforce / SAP 등 엔터프라이즈 앱 특수 처리

---

*MIMIC — 매뉴얼, 따로 만들 필요 없습니다. 일하면 만들어지니까요.*

# MIMIC — 제품 설계서 v2.0
> **작성일**: 2026-06-09  
> **작성자**: 김정호 (comindworks)  
> **용도**: Claude Code 작업 지침 + 제품 방향성 마스터 문서  
> **이 문서는 기존 CLAUDE.md와 GOAL.md를 대체한다.**

---

## ⚠️ Claude Code에게 — 이 문서를 읽기 전에

이 문서는 제품 방향이 크게 바뀐 시점에 작성된 **마스터 설계서**다.  
모든 작업 전 이 문서를 먼저 읽고, **Section 3의 현재 구현 상태 확인을 먼저 수행**한 뒤 작업을 시작하라.

---

## Section 1. 제품 방향성 재정의

### 1-1. 기본 정보

| 항목 | 내용 |
|------|------|
| 제품명 | **MIMIC** (구 MotionManual AI) |
| 도메인 | mimicflow.com |
| Chrome 확장명 | MIMIC Recorder |
| GitHub | kinjungho-sudo/mimic |
| DB prefix | `MM_` (기존 유지) |
| 회사명 | 코마인드웍스 (Comindworks) |
| 개발 형태 | 1인 솔로 개발 (창업자 정호) |
| 배포 | Vercel |

---

### 1-2. 미션 스테이트먼트

> **"사람들이 복잡한 업무를 더 빨리 배우게 만든다."**

- 학습 속도 개선에 기여하는가? → 만든다
- 매뉴얼 제작 자동화에 기여하는가? → 만든다
- 위 둘에 관계없는 기능 → Out of Scope

---

### 1-3. 타겟 시장

- **1차 타겟**: 한국 B2B SaaS의 CS팀 (고객 지원, 온보딩 담당자)
- **기업 규모**: 시리즈 A~B, 20~100인 규모
- **확장 타겟**: 사내 교육팀, 기술지원팀, 프리세일즈팀

---

### 1-4. 핵심 비전 — 5레이어 아키텍처

MIMIC은 5개 레이어로 구성되며, **MVP는 L1~L4**가 대상이고 **L5는 장기 로드맵**이다.

```
┌─────────────────────────────────────────────────────┐
│  L5. AI 에이전트 자동화  (Phase 3+, 장기 비전)        │
│  캡처된 좌표 → AI가 반복 실행 / 업무 자동화 인프라    │
├─────────────────────────────────────────────────────┤
│  L4. 인터랙티브 뷰어  (★ MVP 핵심 차별점)            │
│  Guideflow 스타일 / 클릭 유도형 / 단계별 가이드       │
├─────────────────────────────────────────────────────┤
│  L3. AI 편집기  (MVP 포함)                           │
│  AI 자동 어노테이션 / 문서 제목·내용 자동 생성        │
├─────────────────────────────────────────────────────┤
│  L2. 워크스페이스  (MVP 포함, 기본 수준)              │
│  개인/팀 워크스페이스 / 폴더 / 권한 / 공유            │
├─────────────────────────────────────────────────────┤
│  L1. 캡처 엔진  (MVP 핵심, 현재 상당 부분 구현됨)     │
│  Chrome Extension / DOM+좌표 / PII 블러               │
└─────────────────────────────────────────────────────┘
```

---

### 1-5. ⚠️ 기존 설계 대비 핵심 변경점

| 항목 | 구 설계 (MotionManual) | 신 설계 (MIMIC) |
|------|----------------------|----------------|
| 뷰어 방식 | 오디오 마스터 클럭 → 커서 자동 이동 → 비디오형 | 사용자 클릭 → 단계 진행 → Guideflow형 |
| TTS 역할 | 필수 (마커 타임코드 동기화) | 선택 (스텝별 음성 첨부 옵션) |
| 핵심 UX | 수동 재생, 효과 동기화 | 사용자 행동 유도, 클릭으로 기억 |
| 데이터 구조 | 마커 + 오디오 타임코드 | 스텝 + 클릭 좌표 + 어노테이션 |
| 장기 목적 | 인터랙티브 튜토리얼 | AI 에이전트 실행 좌표 (L5) |

> **Claude Code는 기존 비디오형 플레이어 로직(마커 타임코드 동기화, 커서 애니메이션 등)을 새로 구현하지 않는다.**  
> 기존 구현 코드가 있다면 L4 PRD(Section 5-4)를 기준으로 리팩토링 여부를 정호씨에게 확인 후 진행한다.

---

## Section 2. 벤치마킹 솔루션 및 기능 구현 방안

### 2-1. 레이어별 벤치마크

| 레이어 | 벤치마크 | 우리가 참고할 것 | 우리의 차별점 |
|--------|---------|----------------|------------|
| L1 캡처 | Scribe, Tango AI, StepHow | 사이드 패널 캡처, PII 자동 블러 | DOM 셀렉터 + Vision 하이브리드 (L5 준비) |
| L2 워크스페이스 | Scribe, StepHow | 개인/팀 분리, 폴더, 권한 | (동일 수준 구현 목표) |
| L3 편집기 | Tango AI, StepHow | AI 자동 어노테이션, 제목/설명 자동 생성 | Claude API 기반 고품질 한국어 생성 |
| L4 뷰어 | **Guideflow** | 인터랙티브 슬라이드쇼, 클릭 유도 | AI 음성/자막 선택 첨부, 한국어 최적화 |
| L5 자동화 | Claude in Chrome, Tango AI | 반복 워크플로우 자동화 개념 | 캡처 데이터 = AI 실행 좌표 (완성 없음) |

---

### 2-2. L1 캡처 엔진 — 기술 구현 방향

**캡처 방식 (Chrome Extension MV3)**
- 사이드 패널 UI로 동작 (화면 방해 최소화)
- 클릭 이벤트 → DOM 셀렉터 추출 + 화면 캡처(스크린샷) 동시 저장
- 클릭 좌표: `Vision+DOM 하이브리드` — DOM 셀렉터 우선, 실패 시 픽셀 좌표 폴백
- 민감정보 자동 블러: PII 패턴 감지 (이메일, 전화번호, 주민번호 등) → 자동 마스킹

**OS 기반 캡처** (Phase 2 — Electron 앱 전환 시)
- 웹 브라우저 외 데스크탑 앱 캡처 필요 시 Electron + Accessibility API
- 현재 MVP에서는 미구현, 고객 인터뷰 결과에 따라 우선순위 결정

**데이터 구조 원칙 (L5 AI 에이전트 대비)**
```typescript
// 클릭 이벤트 데이터 — L5에서 AI 실행 좌표로 재사용됨
interface CapturedStep {
  step_id: string;
  screenshot_url: string;        // Supabase Storage
  dom_selector: string;          // CSS 셀렉터 (우선)
  coordinates: { x: number; y: number };  // 픽셀 좌표 (폴백)
  viewport: { width: number; height: number };
  page_url: string;
  element_text: string;          // 클릭한 요소의 텍스트
  ai_description?: string;       // Claude API로 생성
  audio_url?: string;            // TTS 또는 사용자 목소리 (선택)
  annotations: Annotation[];     // 어노테이션 배열
  pii_redacted: boolean;
}
```

---

### 2-3. L2 워크스페이스 — 기술 구현 방향

**기본 구조**
- 개인 워크스페이스: 본인만 접근 가능
- 팀 워크스페이스: 팀원 초대, 역할별 권한 (뷰어/편집자/관리자)
- 폴더 구조: 최대 2레벨 (폴더 > 가이드)
- 공유: 공개 링크 (토큰 기반) / 비공개 (로그인 필요)

**MVP 범위**: 개인 워크스페이스 + 공유 링크만 구현. 팀 워크스페이스는 Should Have.

---

### 2-4. L3 AI 편집기 — 기술 구현 방향

**AI 자동 생성 항목**
- 가이드 제목: 캡처 URL + 첫 스텝 컨텍스트로 생성
- 스텝 설명: 클릭한 요소 + 화면 컨텍스트로 1-2문장 생성
- 어노테이션: 박스 하이라이트 위치 자동 추천

**Claude API 프롬프트 원칙**
```typescript
// 스텝 설명 생성 (한국어, CS팀 타겟)
const prompt = `다음 웹 인터페이스 조작을 CS팀 교육용 매뉴얼 스텝으로 설명해줘.

클릭한 요소: ${element_text}
페이지 URL: ${page_url}
이전 스텝: ${prev_step_description}

규칙:
- 1-2문장, 한국어
- 친절하고 명확한 톤
- "~를 클릭합니다" 형식
- 마크다운 금지`;
```

---

### 2-5. L4 인터랙티브 뷰어 — 기술 구현 방향 (★ 최우선)

**핵심 UX 원리** (Guideflow 벤치마크)
- 스텝별 스크린샷 + 어노테이션 표시
- 다음 클릭 위치를 시각적으로 유도 (펄스 애니메이션 + 하이라이트)
- 사용자가 직접 클릭하거나 "다음" 버튼으로 진행
- 선택적 AI 음성/자막 (스텝별 독립 재생, 마스터 클럭 없음)

**뷰어 데이터 플로우**
```
스텝 로드
  ↓
스크린샷 렌더링
  ↓
어노테이션 오버레이 (박스/화살표/텍스트)
  ↓
클릭 유도 요소 표시 (펄스 원 + 하이라이트)
  ↓
사용자 클릭 OR "다음" 버튼 → 다음 스텝
  ↓ (선택적)
스텝별 오디오 자동 재생 (있는 경우)
```

**핵심 컴포넌트**
```typescript
// 뷰어 스텝 상태
interface ViewerState {
  currentStepIndex: number;
  totalSteps: number;
  isPlaying: boolean;           // 오디오 재생 중 여부
  showHotspot: boolean;         // 클릭 유도 표시 여부
}

// 클릭 유도 핫스팟
interface Hotspot {
  x: number;                    // 정규화 좌표 (0-1)
  y: number;
  pulse: boolean;               // 펄스 애니메이션
  label?: string;               // "여기를 클릭하세요"
}
```

---

### 2-6. L5 AI 에이전트 자동화 — 비전 (현재 미구현)

> **이 레이어는 MVP에 포함하지 않는다. 단, L1~L4의 데이터 구조는 L5를 고려하여 설계한다.**

**핵심 아이디어**
- L1에서 캡처된 `dom_selector + coordinates`는 AI 에이전트 실행 좌표로 재사용 가능
- 사람이 한 번 시연 → MIMIC이 가이드 생성 → AI가 동일 작업 자동 반복
- Tango AI, Claude in Chrome 모두 시도했지만 완성하지 못한 영역

**Phase 3+ 로드맵**
- Electron 데스크탑 앱에서 Playwright/Puppeteer 기반 자동 실행
- 가이드의 각 스텝 = 자동화 스크립트의 한 액션
- 스케줄 실행, 조건 분기 지원

---

## Section 3. 현재 구현 상태 확인 요청

> **Claude Code에게**: 아래 항목들을 코드베이스에서 직접 확인하고, 각 항목의 현재 상태를 보고하라.  
> 확인 후 정호씨에게 보고하고 다음 섹션으로 진행하라.

### 3-1. 확인 항목 체크리스트

**프로젝트 기본 구조**
- [ ] 실제 파일 트리 구조 (app/, components/, lib/ 등)
- [ ] package.json — 현재 설치된 주요 패키지 목록
- [ ] .env.local 존재 여부 (내용 노출 금지, 존재 여부만 확인)
- [ ] Supabase 프로젝트 연결 상태 (project ID: gqynptpjomcqzxyykqic)

**L1 캡처 엔진 (Chrome Extension)**
- [ ] Chrome Extension 기본 구조 존재 여부 (manifest.json 등)
- [ ] DOM 셀렉터 기반 캡처 구현 수준 (없음/부분/완료)
- [ ] Vision+DOM 하이브리드 좌표 시스템 구현 수준
- [ ] 박스 하이라이트 어노테이션 구현 수준
- [ ] 자동 코멘트/설명 생성 구현 수준
- [ ] PII 자동 블러 구현 여부

**L2 워크스페이스**
- [ ] Supabase DB 테이블 현황 (MM_ prefix 테이블 목록)
- [ ] 인증(Auth) 구현 수준 (없음/부분/완료)
- [ ] 대시보드 구현 수준

**L3 편집기**
- [ ] 에디터 컴포넌트 구현 수준
- [ ] Claude API 연동 상태 (없음/부분/완료)
- [ ] 어노테이션 편집 기능 구현 수준

**L4 뷰어**
- [ ] Guide Me 컴포넌트 현재 파일 위치
- [ ] Guide Me 구현 수준 (없음/부분/완료)
- [ ] 인터랙티브 뷰어 관련 코드 현황

**배포**
- [ ] Vercel 배포 현황 (없음/스테이징/프로덕션)
- [ ] 현재 접근 가능한 URL

### 3-2. 보고 형식

```
[MIMIC 현황 보고]
날짜: YYYY-MM-DD

L1 캡처: [없음/부분/완료] — [구체적 내용]
L2 워크스페이스: [없음/부분/완료] — [구체적 내용]
L3 편집기: [없음/부분/완료] — [구체적 내용]
L4 뷰어: [없음/부분/완료] — [구체적 내용]
DB 테이블: [목록]
배포 URL: [URL 또는 "미배포"]

주요 발견사항:
- [기존 코드와 신규 설계 간 불일치 항목]
- [즉시 정호씨 판단이 필요한 사항]
```

---

## Section 4. MoSCoW 우선순위 및 로드맵

### 4-1. MVP 범위 (Must Have)

> **캠프 마감 6월 말까지 완성 목표**

| 기능 | 레이어 | 설명 |
|------|--------|------|
| Chrome Extension 기본 캡처 | L1 | 클릭 녹화, 스크린샷 저장, DOM 셀렉터 추출 |
| AI 스텝 설명 자동 생성 | L1+L3 | 클릭 컨텍스트 → Claude API → 한 줄 설명 |
| 박스 하이라이트 어노테이션 | L1+L3 | 클릭 위치 자동 하이라이트 |
| 가이드 목록/대시보드 | L2 | 내가 만든 가이드 목록, 기본 관리 |
| 공유 링크 생성 | L2 | 토큰 기반 공개 URL |
| **인터랙티브 뷰어** | **L4** | **Guideflow형 클릭 유도, 스텝 진행** |
| 기본 편집기 (텍스트 수정) | L3 | AI 생성 설명 수동 편집 |
| 로그인/회원가입 | L2 | Supabase Auth (Google OAuth + 이메일) |

### 4-2. Should Have (MVP+ / v1.1)

| 기능 | 레이어 | 설명 |
|------|--------|------|
| PII 자동 블러 | L1 | 민감정보 자동 감지 및 마스킹 |
| 스텝별 AI 음성 (TTS) | L4 | OpenAI TTS, 스텝별 독립 재생 |
| 사용자 목소리 녹음 | L4 | 스텝별 마이크 녹음 첨부 |
| 팀 워크스페이스 | L2 | 팀원 초대, 역할 권한 |
| 어노테이션 수동 편집 | L3 | 박스/화살표/텍스트 위치 조정 |
| 가이드 제목 AI 생성 | L3 | 전체 가이드 제목 자동 추천 |
| 시청 이벤트 로깅 | L2 | 스텝별 진입/종료 DB 저장 |

### 4-3. Could Have (v1.2+)

| 기능 | 레이어 | 설명 |
|------|--------|------|
| 폴더 구조 | L2 | 가이드 폴더 분류 |
| PDF 내보내기 | L2 | 가이드 → PDF 변환 |
| 분석 대시보드 | L2 | 시청률, 이탈률 |
| 커스텀 브랜딩 | L2 | 로고, 색상 |
| OS 기반 캡처 | L1 | Electron 앱, 데스크탑 소프트웨어 캡처 |

### 4-4. Won't Have (향후 로드맵)

| 기능 | 레이어 | 이유 |
|------|--------|------|
| AI 에이전트 자동화 | L5 | Phase 3+ 장기 비전 |
| 온프레미스 배포 | - | 고객 인터뷰 후 결정 |
| 모바일 캡처 | L1 | iOS/Android 정책 제약, Phase 3+ |
| 결제 시스템 | - | MVP 외 |
| 실시간 공동 편집 | L2 | MVP 외 |

---

### 4-5. 개발 단계 로드맵

```
Phase 1 (현재) — Chrome Extension MVP
  L1 캡처 완성 → L3 AI 편집기 기본 → L4 인터랙티브 뷰어 → L2 워크스페이스 기본

Phase 2 — Electron 데스크탑 앱
  OS 기반 캡처 → 데스크탑 앱 배포 → 온프레미스 옵션 (인터뷰 결과 따라)

Phase 3 — 모바일 + AI 자동화 진입
  Android Accessibility Service → iOS 화면 녹화 + AI 추출
  AI 에이전트 자동화 (L5) 초기 구현

Phase 4 — 온프레미스 / 프라이빗 클라우드
  고객 인터뷰 결과에 따라 조건부 실행
```

---

## Section 5. 핵심 기능 PRD

### 5-1. PRD-L1: Chrome Extension 캡처

**목적**: 사용자의 웹 브라우저 조작을 자동으로 캡처하여 구조화된 스텝 데이터로 저장

**기능 정의**
1. 녹화 시작/종료 버튼 (사이드 패널 또는 툴바 아이콘)
2. 클릭 이벤트 감지 → 즉시 스크린샷 캡처
3. DOM 셀렉터 추출 (CSS 셀렉터 최소 경로)
4. 클릭 좌표 저장 (정규화 좌표 0-1 범위)
5. Supabase Storage에 스크린샷 업로드
6. Claude API 호출 → 스텝 설명 자동 생성

**완료 기준**
- [ ] 녹화 시작 후 클릭 시 스크린샷 + 메타데이터 저장
- [ ] 생성된 가이드가 대시보드에 표시
- [ ] 스텝별 DOM 셀렉터 + 좌표 DB 저장 확인
- [ ] AI 설명이 한국어로 자동 생성됨

**기술 스택**
- Chrome Extension MV3
- Content Script: 이벤트 리스너
- Background Service Worker: 스크린샷 + 업로드
- Side Panel: 녹화 컨트롤 UI

---

### 5-2. PRD-L2: 워크스페이스 기본

**목적**: 생성된 가이드를 관리하고 외부에 공유할 수 있는 기본 플랫폼

**기능 정의**
1. 로그인/회원가입 (Google OAuth + 이메일)
2. 대시보드: 내 가이드 목록, 검색, 정렬
3. 가이드 생성/삭제/이름 변경
4. 공유 링크: 토큰 기반 공개 URL 생성
5. 비공개 토글: 링크 알아야만 접근 가능

**DB 스키마**

```sql
-- 사용자
CREATE TABLE MM_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 가이드 (상위 단위)
CREATE TABLE MM_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES MM_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '제목 없는 가이드',
  share_token TEXT UNIQUE,           -- 공유 링크 토큰
  is_public BOOLEAN DEFAULT false,
  step_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 스텝 (캡처 단위)
CREATE TABLE MM_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID REFERENCES MM_guides(id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  screenshot_url TEXT NOT NULL,
  dom_selector TEXT,                 -- L5 AI 에이전트 실행 좌표
  coordinates JSONB,                 -- { x: 0.5, y: 0.3 } 정규화 좌표
  viewport JSONB,                    -- { width: 1440, height: 900 }
  page_url TEXT,
  element_text TEXT,
  ai_description TEXT,               -- Claude API 생성
  audio_url TEXT,                    -- TTS 또는 사용자 목소리 (선택)
  annotations JSONB DEFAULT '[]',    -- 어노테이션 배열
  pii_redacted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 시청 이벤트 (KPI 측정용)
CREATE TABLE MM_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID REFERENCES MM_guides(id),
  step_id UUID REFERENCES MM_steps(id),
  session_id TEXT,
  event_type TEXT,                   -- 'step_view', 'step_complete', 'guide_complete'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS 정책**
- MM_guides: 본인만 읽기/쓰기, public=true이면 share_token으로 읽기 가능
- MM_steps: 가이드 소유자만 쓰기, public 가이드는 누구나 읽기
- MM_view_events: 누구나 INSERT, 소유자만 읽기

---

### 5-3. PRD-L3: AI 편집기

**목적**: 캡처된 스텝을 AI가 자동으로 편집하여 즉시 공유 가능한 가이드로 만들기

**기능 정의**
1. 스텝 목록 사이드바 (순서 변경, 삭제, 추가)
2. 스크린샷 위에 어노테이션 오버레이 표시
3. AI 설명 텍스트 인라인 편집
4. "AI로 다시 생성" 버튼
5. 어노테이션 수동 조정 (Should Have)

**어노테이션 데이터 구조**
```typescript
interface Annotation {
  id: string;
  type: 'box' | 'arrow' | 'text' | 'circle';
  x: number;        // 정규화 좌표 (0-1)
  y: number;
  width?: number;
  height?: number;
  color: string;    // 기본값: '#4F46E5' (인디고)
  label?: string;
  thickness: number;
}
```

**완료 기준**
- [ ] 스텝 설명 수동 편집 → 저장 (debounce 500ms)
- [ ] AI 재생성 → Claude API → 새 설명으로 교체
- [ ] 어노테이션이 스크린샷 위에 정확히 오버레이
- [ ] 스텝 순서 드래그 앤 드롭

---

### 5-4. PRD-L4: 인터랙티브 뷰어 (★ 최우선 PRD)

**목적**: 사용자가 클릭으로 직접 따라하면서 업무를 배울 수 있는 인터랙티브 가이드 플레이어

**핵심 UX 원칙** (Guideflow 기준)
- 각 스텝 = 스크린샷 + 어노테이션 + 클릭 유도 핫스팟
- 사용자가 클릭하거나 "다음" 버튼으로 진행
- 오디오는 옵션 (있으면 스텝 로드 시 자동 재생)
- 마스터 클럭 없음 — 사용자 페이스 존중

**화면 구성**
```
┌─────────────────────────────────────────┐
│  헤더: 가이드 제목 + 스텝 N/M            │
├─────────────────────────────────────────┤
│                                         │
│  스크린샷 영역                           │
│  + 어노테이션 오버레이                   │
│  + 클릭 유도 핫스팟 (펄스 애니메이션)    │
│                                         │
├─────────────────────────────────────────┤
│  스텝 설명 텍스트                        │
│  [이전] ←————————— [다음 →]             │
│  ○ ○ ● ○ ○  (진행 인디케이터)           │
└─────────────────────────────────────────┘
```

**상세 기능 정의**
1. **스크린샷 렌더링**: 원본 비율 유지, 반응형
2. **어노테이션 오버레이**: 박스/화살표/텍스트 SVG 레이어
3. **클릭 유도 핫스팟**:
   - 클릭 좌표에 펄스 애니메이션 원 표시 (2-3초 주기)
   - 반경 약 40px의 반투명 원형 + 외곽 펄스
   - 색상: 인디고 (#4F46E5)
   - 사용자가 핫스팟 클릭 시 → 다음 스텝으로 자동 이동 (옵션)
4. **진행 컨트롤**:
   - 이전/다음 버튼 항상 표시
   - 하단 도트 인디케이터 (클릭 가능)
   - 키보드 방향키 지원 (→ 다음, ← 이전)
5. **오디오 (선택)**:
   - 스텝에 audio_url 있으면 스텝 로드 시 자동 재생
   - 재생/일시정지 버튼
   - 음소거 토글
6. **공유 페이지**:
   - `/play/[share_token]` 경로
   - 로그인 없이 접근 가능
   - 뷰어 UI만 표시 (편집 기능 없음)

**완료 기준**
- [ ] `/play/[share_token]` 로그인 없이 접근 가능
- [ ] 스텝별 스크린샷 + 어노테이션 오버레이 정확히 표시
- [ ] 핫스팟 펄스 애니메이션 표시
- [ ] 이전/다음 버튼으로 스텝 이동
- [ ] 진행 인디케이터 정확히 표시
- [ ] 오디오 있는 스텝: 자동 재생
- [ ] 키보드 방향키 지원

---

## Section 6. 통합 테스트 방안 (GOAL)

### 6-1. 개발 단계별 완료 기준

**Stage 1: 환경 설정**
- [ ] npm install → 에러 0건
- [ ] npm run dev → localhost:3000 응답
- [ ] Supabase 연결 성공 (project: gqynptpjomcqzxyykqic)
- [ ] Claude API 키 유효
- [ ] OpenAI API 키 유효
- [ ] .env.local .gitignore에 포함

**Stage 2: DB + Auth**
- [ ] MM_users, MM_guides, MM_steps, MM_view_events 테이블 생성
- [ ] RLS 정책 활성화 (4개 테이블)
- [ ] Google OAuth 로그인 성공
- [ ] 이메일 로그인 성공
- [ ] 로그아웃 후 대시보드 접근 시 로그인 페이지로 리다이렉트

**Stage 3: L1 캡처 Chrome Extension**
- [ ] Extension 설치 후 사이드 패널 오픈
- [ ] 녹화 시작 → 클릭 → 스크린샷 Supabase Storage 저장
- [ ] DOM 셀렉터 + 좌표 MM_steps 테이블에 저장
- [ ] Claude API → 스텝 설명 한국어 생성 (8초 이내)
- [ ] 녹화 완료 → 대시보드에 가이드 생성됨

**Stage 4: L3 편집기**
- [ ] 스텝 목록 표시
- [ ] 설명 텍스트 수정 → 자동 저장 (500ms debounce)
- [ ] 어노테이션 스크린샷 위에 오버레이 표시
- [ ] "AI로 재생성" → 새 설명으로 교체

**Stage 5: L4 인터랙티브 뷰어 (★ 핵심)**
- [ ] `/play/[share_token]` 로그인 없이 접근
- [ ] 스텝별 스크린샷 + 어노테이션 표시
- [ ] 핫스팟 펄스 애니메이션 표시
- [ ] 이전/다음 버튼 작동
- [ ] 진행 인디케이터 정확히 표시
- [ ] 키보드 방향키 작동
- [ ] 오디오 있는 스텝: 자동 재생 + 일시정지

**Stage 6: 통합 E2E 시나리오**

```
시나리오 A (제작자 플로우):
회원가입 → 로그인 → Extension 설치 → 녹화 시작
→ 웹사이트에서 3번 클릭 → 녹화 완료
→ 대시보드에서 가이드 확인
→ 편집기에서 설명 수정
→ 공유 링크 생성

시나리오 B (시청자 플로우):
공유 링크 접속 (로그인 없음)
→ 첫 스텝 확인 → 핫스팟 확인
→ "다음" 클릭 3번
→ 마지막 스텝 "완료" 클릭
→ 완료 이벤트 DB 저장 확인
```

### 6-2. KPI 측정 가능 조건

MVP 출시 후 다음 KPI를 측정할 수 있도록 DB 이벤트 로깅이 준비되어야 한다.

| KPI | 측정 방법 |
|-----|---------|
| 가이드 완료율 | MM_view_events에서 guide_complete / 첫 스텝 진입 |
| 스텝별 이탈률 | 각 스텝 view 대비 다음 스텝 view 비율 |
| 제작 시간 | MM_guides.created_at - Extension 설치 시간 |

---

## Section 7. 기술 원칙 (추가 지침)

### 7-1. 환경변수 분리 원칙 (온프레미스 대비)

> **나중에 온프레미스 옵션을 추가할 때 리팩토링 최소화를 위해 처음부터 지킨다.**

```typescript
// ❌ 하드코딩 금지
const supabaseUrl = 'https://gqynptpjomcqzxyykqic.supabase.co';

// ✅ 환경변수로만
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
```

모든 외부 서비스 URL, 키, 엔드포인트는 반드시 `.env.local`로 분리한다.

**필수 환경변수 목록**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI APIs
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

### 7-2. L5 AI 에이전트 대비 데이터 설계 원칙

- `dom_selector` 컬럼은 항상 저장 (L5에서 AI 실행 좌표로 재사용)
- `coordinates`는 정규화 좌표(0-1)로 저장 (해상도 독립적)
- `viewport` 정보 함께 저장 (좌표 변환 시 필요)
- 이 데이터를 삭제하거나 생략하지 않는다

### 7-3. 보안 원칙

- Service Role Key → 서버 사이드(API Route)에서만
- 모든 테이블 RLS 활성화 필수
- API Route에 입력 검증 (zod 권장)
- 파일 업로드: MIME 타입 + 크기 검증 (최대 5MB)

### 7-4. 네이밍 규칙

| 구분 | 규칙 | 예시 |
|------|------|------|
| DB 테이블 | `MM_` 접두사 + snake_case | `MM_guides`, `MM_steps` |
| 컴포넌트 | PascalCase | `GuideViewer.tsx` |
| 훅 | camelCase + use | `useViewer.ts` |
| 환경변수 | SCREAMING_SNAKE_CASE | `ANTHROPIC_API_KEY` |

### 7-5. 폴더 구조 (목표 구조)

```
/mimic
├── /app
│   ├── /auth
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── /dashboard/page.tsx
│   ├── /editor/[id]/page.tsx
│   ├── /play/[token]/page.tsx       ← L4 뷰어 공유 경로
│   └── /api
│       ├── /guides/route.ts
│       ├── /steps/route.ts
│       ├── /generate-description/route.ts  ← Claude API
│       ├── /tts/route.ts
│       └── /upload/route.ts
├── /components
│   ├── /viewer                      ← L4 인터랙티브 뷰어
│   │   ├── GuideViewer.tsx          ← 메인 뷰어 컴포넌트
│   │   ├── StepDisplay.tsx          ← 스크린샷 + 어노테이션
│   │   ├── Hotspot.tsx              ← 클릭 유도 핫스팟
│   │   ├── AnnotationOverlay.tsx    ← 어노테이션 SVG 레이어
│   │   └── StepProgress.tsx         ← 진행 인디케이터
│   ├── /editor                      ← L3 편집기
│   │   ├── GuideEditor.tsx
│   │   ├── StepList.tsx
│   │   └── AnnotationEditor.tsx
│   ├── /dashboard                   ← L2 워크스페이스
│   │   └── GuideCard.tsx
│   └── /ui                          ← shadcn 컴포넌트
├── /lib
│   ├── supabase.ts
│   ├── supabase-server.ts
│   ├── claude.ts
│   └── utils.ts
├── /hooks
│   ├── useViewer.ts                 ← L4 뷰어 상태 관리
│   └── useEditor.ts
├── /types/index.ts
└── /extension                       ← Chrome Extension (별도)
    ├── manifest.json
    ├── background.ts
    ├── content.ts
    └── sidepanel/
```

---

## Section 8. 협업 트리거 (정호씨 명령어)

| 명령어 | 동작 |
|--------|------|
| "검증 해줘" | 현재 구현 코드 타입/보안/성능 점검 |
| "현황 보고" | Section 3 체크리스트 기준으로 현재 상태 보고 |
| "다음 단계 ㄱㄱ" | 현재 Stage 완료 확인 후 다음 Stage 시작 |
| "롤백" | 마지막 작업 되돌리기 |
| "킥오프" | 신규 기능 개발 시작 (project-kickoff-review 스킬 실행) |
| "정리해줘" | 현재 진행 상황 + 다음 액션 요약 |

---

## Section 9. 작업 원칙

1. **정호씨 결정이 필요한 사항 즉시 보고** — 자동 수정 3회 실패 시, DB 스키마 변경 필요 시, 보안 관련 의사결정 필요 시
2. **같은 실수 반복 금지** — 발생한 오류와 해결책을 작업 중 Mistake Ledger에 기록
3. **기존 코드 확인 후 작업** — 중복 구현 방지, 충돌 사전 확인
4. **API 키 하드코딩 절대 금지**
5. **RLS 없는 테이블 생성 금지**

---

## Section 10. 제품 라인 재정의 & 인터랙티브 매뉴얼 / Guide Me 스튜디오 설계 (2026-06-15 확정)

> 배경: 유사 기능(따라하기·Guide Me·Auto-Run·슬라이드뷰·미리보기 패널)이 의미 없이 중복되며 "보여주는 방법"만 늘어나던 문제를 정리.
> 제품 구조 = 과금 구조가 1:1로 맞도록 재정의하고, 핵심 차별점을 **인터랙티브 가이드(사람의 행동을 유도하는 AI 도우미)**로 명확히 함.
> (기존 L3=문서 편집기, L4=인터랙티브 뷰어, L5=AI 에이전트와 연결됨)

### 10-1. 두 제품 라인 + 실전 모드 (같은 녹화에서 출발)

```
[녹화/캡처]  ← 공통 입력 (확장이 클릭·스샷·좌표·셀렉터 → DB)
    │
    ├─ ① 문서 매뉴얼  (= L3, 기존 에디터)
    │     AI 자동생성·거의 무편집 / 세로 읽기 업무 문서 / 뷰어: 문서뷰·Word·임베드·URL
    │     → "매뉴얼 자동화" 라인.  (요금제: Basic)
    │
    └─ ② 인터랙티브 매뉴얼  (= L4, Guide Me 스튜디오로 저작)
          가상 크롬 화면 슬라이드 + AI 캐릭터 + 2단 툴팁(행동/설명) + 하이라이트·화살표·클릭 진행
          확장 불필요(모든 브라우저/모바일) · 결제·삭제도 안전(가상) · 체험/교육형
          → 문서에서 "업그레이드"로 생성.  (요금제: Pro)
          │
          └─ ③ Guide Me 실전 (= L5 전 단계, Beta)
                인터랙티브 매뉴얼 기반 재사용 → 실제 페이지로 이동 + 확장이 실제 화면 위에서 같은 가이드 실행
                사용자가 진짜 클릭하며 따라함. 크롬 확장 전용. (요금제: Pro)
```

**확장 한계 해소**: 인터랙티브 매뉴얼(연습)은 **확장 없이 누구나** 쓰고, 확장은 "진짜로 해볼 때(실전)"만 필요 → 한계를 *티어드 오퍼링*으로 전환.

### 10-2. 생성 흐름 (확정: 옵션 2 — 문서 → 업그레이드)
1. 녹화 캡처 완료 → **문서 매뉴얼 자동 생성**(기본, 마찰 0).
2. 문서 편집기에서 **"인터랙티브 매뉴얼로 만들기"** CTA(= Free/Basic→Pro 업셀) → Guide Me 스튜디오 진입.
3. 인터랙티브 매뉴얼이 완성되면 그 위에서 **Guide Me(실전)** 버튼으로 확장 실행.
- 자동 동시생성(옵션1) / 시작 시 선택(옵션3)은 채택 안 함 — 반제품 양산·의미 희석 방지.

### 10-3. 데이터 모델 — 단일 레코드 + 인터랙티브 레이어
별도 복제본을 만들지 않는다. **하나의 `mm_tutorials` + 스텝당 인터랙티브 전용 필드(추가 레이어)**:
- 공유 기반(문서/인터랙티브 공통): `mm_steps`의 제목·설명·`screenshot_url`·`element_selector`·`element_rect`·`click_x/y`·`page_url`
- 인터랙티브 전용 추가(업그레이드 시 문서 내용에서 시드):
  - `action_label` (행동 라벨, 짧게 — 화살표/툴팁 헤드): "생성 버튼을 누르세요"
  - `explanation` (설명/결과): "누르면 결과가 생성돼요"
  - `arrow_dir` ('auto'|상하좌우), `character_cue`(캐릭터 포즈/상태, 선택)
  - `target` 보정값(작성자가 스튜디오에서 다시 콕 찍은 셀렉터/좌표)
- `mm_tutorials.has_interactive` 플래그 + (구현 시) `mm_steps` 컬럼 추가 **또는** 1:1 `mm_step_guide` 테이블 — 둘 다 "단일 레코드+레이어" 원칙 충족(복제 아님). 구현 시 확정. RLS 필수.

### 10-4. Guide Me 스튜디오 (신규 별도 화면, 저작 전용)
- 기존 문서 편집기 `/manual/[id]/editor`는 **그대로**, 인터랙티브 저작만 별도 풀스크린 `/manual/[id]/guide`(가칭).
- 핵심: **스튜디오 화면 ≈ 인터랙티브 플레이어 + 인라인 편집.** 같은 렌더(스샷+캐릭터+툴팁+하이라이트)를 쓰고 편집 가능 여부만 다름 → 플레이어를 잘 만들면 스튜디오는 거의 공짜.
- 저작 항목: 스텝별 타깃 확인/재바인딩, 행동 라벨, 설명 툴팁, 화살표 방향, 캐릭터 미리보기, 순서.

### 10-5. 인터랙티브 플레이어 (연습 모드) — 인터랙션
- 스샷을 **가상 크롬 화면**처럼 렌더(브라우저 프레임 느낌) + AI 캐릭터가 타깃 옆에서 **2단 말풍선**(행동/설명).
- 타깃 하이라이트 + 클릭 핫스팟. **사용자가 핫스팟을 클릭하면 자동으로 다음 스텝**(엔진 로직은 확장용 `guide-engine.js`와 동일 모델 — 웹용 한 벌 더). 진행도·이전/다음·종료·완료 화면.
- AI 캐릭터: 고해상 마스코트는 브랜드/표지용, 오버레이엔 **작고 가벼운(애니메이션) 버전**.
- 향후: 대화형 챗봇(캐릭터가 질문에 답).

### 10-6. Guide Me 실전 (확장) — 현재 상태
- 엔진(`mimic_recorder/guide-engine.js`) **이미 구현**: selector→element_rect→클릭좌표 핫스팟 폴백, 스크롤 추적, 타깃 클릭 자동 진행, 진행도/이전/다음/종료, 완료, not-found graceful. 자체 검증(14/14)·시각 확인 완료, **실사이트 라이브 검증 대기**.
- 인터랙티브 매뉴얼의 저작 데이터(타깃·행동·설명)를 그대로 실전에서 재사용.

### 10-7. Tango 벤치마크 / 차별점
- 가져올 것: 요소 앵커 툴팁 + 행동 시 자동 진행, 못 찾으면 건너뛰기.
- 이길 것: ① **AI 캐릭터의 따뜻하고 설명적인 톤**(초보 타깃) ② **연습/실전 듀얼 모드**(Tango는 라이브=확장 의존, 우리는 연습이 확장 불필요) ③ 좌표 폴백 기반 **회복력**.

### 10-8. 요금제 게이팅 (Section 1·4와 연결)
| 티어 | 제공 | Free 한도 |
|------|------|----------|
| Free | 문서화 + 인터랙티브(데모) | 보유 5개(인터랙티브 2개), 월 생성 5회(재생성 포함), **Guide Me 실전 불가** |
| Basic | 문서화 + 공유(PDF·임베드·URL) | — |
| Pro | + 인터랙티브 + Guide Me 실전 | — |
| Enterprise/Team(검토중) | 전기능 + 팀 권한 + 복잡 매뉴얼 통합 | 협업(댓글·활동로그·초대공유·워크스페이스) 귀속, 향후 |
- `mm_users.plan` 존재하나 한도 enforce는 비활성(finalize TODO) → 정식 출시 전 별도 작업.

### 10-9. 신규 / 유지 / 은퇴
- **은퇴**: 수동 슬라이드 플레이어(passive), iframe "Guide Me 미리보기"(사이트 iframe 차단으로 구조적 불가), `FollowAlongOverlay`·`SdkPreviewPanel` 스샷 슬라이드쇼 → 인터랙티브로 흡수.
- **유지**: 문서뷰 / Word·PDF / 임베드·URL.
- **신규**: Guide Me 스튜디오, 인터랙티브 플레이어(연습), Guide Me 실전(엔진 완료·검증 대기).

### 10-10. 빌드 순서
1. **인터랙티브 플레이어(연습 모드)** — 웹·스샷·캐릭터·2단 툴팁·클릭 진행 (확장 불필요, 리스크 낮음, 따라하기 흡수).
2. **Guide Me 스튜디오** — (1)에 인라인 편집 + 데이터 레이어 저작.
3. **Guide Me 실전 라이브 검증** 후 (1)(2) 데이터로 확장 연계 안정화.
4. (정식 출시 전) **요금제 게이팅** enforce.

---

## 변경 이력

| 버전 | 날짜 | 주요 변경 |
|------|------|---------|
| v1.0 | 2026-05-20 | MotionManual AI 초안 (비디오형 플레이어 기준) |
| v2.0 | 2026-06-09 | MIMIC으로 리브랜딩, 5레이어 아키텍처 확정, Guideflow형 인터랙티브 뷰어로 방향 전환, MoSCoW 우선순위 정의 |
| v2.1 | 2026-06-15 | Section 10 추가 — 2제품 라인(문서/인터랙티브)+실전 Guide Me 재정의, 생성 흐름(문서→업그레이드), 단일 레코드+인터랙티브 레이어 데이터 모델, Guide Me 스튜디오, 연습/실전 듀얼 모드, 요금제 게이팅(Free 한도), 중복 기능 은퇴 정리 |

---

*— MIMIC Product Design v2.0 — 작성: 김정호 / 코마인드웍스 —*

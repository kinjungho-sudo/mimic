# MIMIC 백엔드 설계서

> **MIMIC · Backend Build Specification v3.0**
> *Don't Explain, Just Mimic.*
> 의뢰자: 김정호 (PM) · 담당: 클로드 코드 (Backend)
> 환경: 빈 폴더에서 처음부터 시작
> 디자인: 디자인 핸드오프로 받음 (page.tsx + components/* + 토큰)
> 작성일: 2026.05.26

---

## 0. 제품 정보

| 항목 | 값 |
|------|-----|
| **제품명** | MIMIC |
| **메인 카피** | Don't Explain, Just Mimic. |
| **서브 카피** | 말 길게 설명하지 마세요. 그냥 보고 따라 하게 만드세요. |
| **태그라인** | AI 인터랙티브 매뉴얼 플랫폼 |
| **공식 도메인** | mimicflow.com |
| **배포 URL (Vercel 자동)** | mimic.vercel.app → 추후 mimicflow.com 연결 |
| **GitHub 레포** | github.com/kinjungho-sudo/mimic (새 레포) |
| **회사명** | 코마인드웍스 |
| **Chrome 확장명** | MIMIC Recorder (Naviaction 기능 유지 + 이름만 변경) |
| **Supabase 인스턴스** | gqynptpjomcqzxyykqic (Naviaction과 공유) |

---

## 1. 이 문서의 위치

**백엔드 단독 설계서** — 처음부터 빈 폴더에서 시작.

### 책임 범위

```
[클로드 코드 = 이 문서의 작업자]
✓ Next.js 14 프로젝트 초기 셋업
✓ Supabase 스키마 + RLS + 마이그레이션
✓ Supabase Auth + Google OAuth 통합
✓ 모든 API Routes (15개+)
✓ Claude API + OpenAI TTS 백엔드 래퍼
✓ MIMIC Recorder Chrome 확장 연동 API
✓ 인증·권한·보안·Rate Limiting·Validation
✓ 타입 정의 + 클라이언트용 라이브러리
✓ 환경변수 + 배포 검증

[클로드 디자인 = 핸드오프]
✗ UI 컴포넌트
✗ 페이지 레이아웃
✗ 디자인 토큰 (--mm-* CSS 변수)
✗ Framer Motion / Konva 시각화
```

### 디자인 핸드오프 받을 자산

- `app/page.tsx` (랜딩)
- `app/(auth)/login/page.tsx`, `signup/page.tsx`
- `app/(dashboard)/dashboard`, `mypage`, `settings`, `extension-link`
- `app/editor/[id]/page.tsx`
- `app/play/[token]/page.tsx`
- `app/legal/terms`, `privacy`
- `components/landing/*`, `dashboard/*`, `editor/*`, `player/*`, `modals/*`
- `app/globals.css` (디자인 토큰 + Pretendard)
- `tailwind.config.ts`

---

## 2. 작업 원칙 (7가지)

| # | 원칙 | 이유 |
|---|------|------|
| 1 | **Service Role Key는 API Route에서만 사용.** 클라이언트 import 절대 금지 | 노출 시 전체 DB 탈취 |
| 2 | **모든 테이블에 RLS 정책 필수.** RLS 없는 테이블 생성 금지 | 인증 우회 → 데이터 유출 |
| 3 | **모든 API Route에 zod 입력 검증** | SQL Injection / 비정상 데이터 |
| 4 | **외부 API (Claude·OpenAI)는 백엔드 경유만** | API 키 노출 + 비용 폭증 |
| 5 | **모든 API에 인증 가드 + 에러 핸들링 + Rate Limiting** | 무차별 호출 방지 |
| 6 | **클로드 디자인이 호출할 함수는 `lib/api/*` 및 `lib/auth-client.ts`로 노출** | 단일 수정점 |
| 7 | **타입 정의 (`types/index.ts`)가 가장 먼저** | 디자인 mock 데이터 작업 병렬 가능 |

---

## 3. 기술 스택

| 항목 | 값 | 비고 |
|------|----|------|
| 프레임워크 | Next.js 14 (App Router) | 14.2.x |
| 언어 | TypeScript | strict mode |
| 패키지 매니저 | npm | |
| DB | Supabase PostgreSQL | 기존 인스턴스 `gqynptpjomcqzxyykqic` 사용 |
| 인증 | Supabase Auth + Google OAuth | 이메일 가입도 함께 |
| 스토리지 | Supabase Storage | 버킷 2개 (`naviaction` 기존, `mimic-tts` 신설) |
| 외부 AI 1 | Anthropic Claude (claude-sonnet-4-6) | 비전 분석 + 스크립트 생성 |
| 외부 AI 2 | OpenAI TTS (tts-1, voice 'nova') | 한국어 음성 합성 |
| Validation | zod | 모든 API 입력 검증 |
| 스타일링 | Tailwind CSS + shadcn/ui | (디자인 핸드오프) |
| 캔버스 | Konva.js + react-konva | (디자인 핸드오프) |
| 애니메이션 | Framer Motion | (디자인 핸드오프) |
| 아이콘 | lucide-react | (디자인 핸드오프) |
| 배포 | Vercel | GitHub 자동 연결 |
| 외부 확장 | MIMIC Recorder | 정호씨가 코드 수정 (이름만) |

---

## 4. 디렉토리 구조

```
mimic/
├── app/
│   ├── (auth)/                        ← 디자인 핸드오프
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/route.ts          ★ 클로드 코드
│   │
│   ├── (dashboard)/                   ← 디자인 핸드오프
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── mypage/page.tsx
│   │   └── extension-link/page.tsx
│   │
│   ├── editor/[id]/page.tsx           ← 디자인 핸드오프
│   ├── play/[token]/page.tsx          ← 디자인 핸드오프
│   ├── legal/
│   │   ├── terms/page.tsx
│   │   └── privacy/page.tsx
│   ├── page.tsx                       ← 랜딩 (디자인 핸드오프)
│   ├── layout.tsx
│   ├── globals.css                    ← 디자인 토큰 (핸드오프)
│   │
│   └── api/                           ★ 클로드 코드 책임
│       ├── auth/
│       │   ├── callback/route.ts
│       │   └── signup-with-agreements/route.ts
│       ├── extension/
│       │   ├── link/route.ts
│       │   └── verify/route.ts
│       ├── capture/
│       │   ├── analyze/route.ts
│       │   └── save-step/route.ts
│       ├── tutorials/
│       │   ├── route.ts               ← GET list
│       │   └── [id]/
│       │       ├── route.ts           ← GET/PATCH/DELETE
│       │       └── publish/route.ts
│       ├── play/[token]/route.ts
│       ├── generate-script/route.ts
│       ├── generate-markers/route.ts
│       ├── generate-annotations/route.ts
│       ├── tts/route.ts
│       ├── events/route.ts
│       ├── survey/route.ts
│       ├── pro-signup/route.ts
│       └── admin/pro-signups/route.ts ← Phase 2
│
├── components/                        ← 디자인 핸드오프
│   ├── landing/
│   ├── dashboard/
│   ├── editor/
│   ├── player/
│   ├── modals/
│   └── ui/                            ← shadcn/ui
│
├── lib/                               ★ 클로드 코드 책임
│   ├── supabase/
│   │   ├── client.ts                  ← 브라우저용 (anon)
│   │   ├── server.ts                  ← API Route용 (service role)
│   │   └── middleware.ts              ← 세션 갱신 helper
│   ├── api/                           ← 디자인이 호출할 함수
│   │   ├── tutorials.ts
│   │   ├── ai.ts
│   │   ├── events.ts
│   │   └── extension.ts
│   ├── auth-client.ts                 ← 디자인이 사용할 인증
│   ├── auth-guard.ts                  ← API Route 인증 미들웨어
│   ├── claude.ts                      ← Claude API 래퍼
│   ├── openai-tts.ts                  ← OpenAI TTS 래퍼
│   ├── markers.ts                     ← 마커 시간 매핑
│   ├── validators.ts                  ← zod 스키마 모음
│   ├── rate-limit.ts                  ← Rate Limiting
│   ├── env.ts                         ← 환경변수 검증
│   ├── mocks.ts                       ← 디자인용 가짜 데이터
│   └── utils.ts
│
├── hooks/                             ★ 클로드 코드 책임
│   ├── useAuth.ts
│   ├── useTutorial.ts
│   ├── useAutosave.ts                 ← debounce 500ms
│   └── useExtensionLink.ts
│
├── types/                             ★ 클로드 코드 (가장 먼저)
│   ├── database.ts                    ← Supabase 자동 생성
│   ├── api.ts                         ← API 요청·응답 타입
│   └── index.ts                       ← Tutorial, Step, Marker 등
│
├── supabase/                          ★ 클로드 코드 책임
│   └── migrations/
│       ├── 001_create_mm_tables.sql
│       ├── 002_create_mm_rls.sql
│       ├── 003_modify_na_steps.sql    ★ CRITICAL
│       └── 004_create_triggers.sql
│
├── middleware.ts                      ★ 클로드 코드 책임
├── next.config.mjs
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── components.json                    ← shadcn/ui
├── package.json
├── .env.local                         ← Git 무시
├── .env.example                       ← 변수 이름만
├── .gitignore
└── README.md
```

> 📌 **참고**: Chrome 확장은 별도 폴더 (`mimic-recorder/` — 새 레포 또는 기존 NaviAction 레포에서 이름만 변경)에서 정호씨가 직접 작업.

---

## 5. 초기 셋업 명령어

```bash
# 1. Next.js 14 프로젝트 생성
npx create-next-app@14 mimic \
  --typescript --tailwind --app --src-dir=false \
  --import-alias "@/*" --no-eslint

cd mimic

# 2. 핵심 패키지 설치
npm install \
  @supabase/supabase-js@^2.106 \
  @supabase/ssr@^0.10 \
  @anthropic-ai/sdk@^0.97 \
  openai \
  zod@^4 \
  framer-motion@^12 \
  konva@^10 \
  react-konva@^19 \
  lucide-react@^1 \
  clsx \
  tailwind-merge \
  class-variance-authority

# 3. shadcn/ui 초기화
npx shadcn@latest init -d

# 4. 자주 쓸 shadcn 컴포넌트 추가
npx shadcn@latest add button input label textarea \
  dialog dropdown-menu toast skeleton card badge \
  checkbox switch progress

# 5. Supabase CLI (타입 자동 생성용)
npm install -D supabase

# 6. ESLint
npm install -D eslint eslint-config-next@14
```

---

## 6. 환경변수 (.env.example)

```bash
# ─── Supabase (NaviAction과 같은 인스턴스) ───
NEXT_PUBLIC_SUPABASE_URL=https://gqynptpjomcqzxyykqic.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ─── Anthropic Claude (정호씨 신규 발급) ───
ANTHROPIC_API_KEY=

# ─── OpenAI TTS (정호씨 신규 발급) ───
OPENAI_API_KEY=

# ─── Google OAuth (Supabase Auth 연동용) ───
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# ─── App URL ───
NEXT_PUBLIC_APP_URL=https://mimic.vercel.app
# Phase 2 후: https://mimicflow.com

# ─── Chrome Extension ID (MIMIC Recorder) ───
NEXT_PUBLIC_EXTENSION_ID=

# ─── 정호씨 user_id (NA_steps 마이그레이션) ───
ADMIN_USER_ID=
```

**lib/env.ts** — 앱 시작 시 검증:

```typescript
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
];

required.forEach(key => {
  if (!process.env[key]) {
    throw new Error(`Missing env: ${key}`);
  }
});
```

---

## 7. DB 스키마

> **명명 규칙**: 모든 신규 테이블은 `MM_` prefix (MIMIC Manual 약어).
> Naviaction의 `NA_steps`는 그대로 두고 보안 패치만 추가.

### 7-1. 마이그레이션 순서

```
supabase/migrations/
├── 001_create_mm_tables.sql      ← MM_ 테이블 10개
├── 002_create_mm_rls.sql         ← RLS 정책 전부
├── 003_modify_na_steps.sql       ← NA_steps 보안 수정 ★ CRITICAL
└── 004_create_triggers.sql       ← auth.users → MM_users 트리거
```

### 7-2. 테이블 명세

#### MM_users — 사용자 정보

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` (PK) | uuid | FK to `auth.users.id` |
| `email` | text | 고유 |
| `name` | text | 표시 이름 |
| `avatar_url` | text NULL | 프로필 이미지 |
| `auth_provider` | text | 'email' \| 'google' |
| `plan` | text | 'free' \| 'pro_waitlist' \| 'pro' \| 'team' (기본 'free') |
| `daily_manual_count` | int | 오늘 만든 수 (자정 KST 리셋) |
| `daily_limit` | int | 기본 3 |
| `agreements` | jsonb | PIPA 동의 기록 + timestamp |
| `created_at` | timestamptz | default now() |

---

#### MM_extension_tokens — MIMIC Recorder 연결용 1회용 토큰

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` (PK) | uuid | |
| `user_id` (FK) | uuid | → MM_users.id |
| `token` | text unique | 랜덤 32자 |
| `used_at` | timestamptz NULL | 1회용 |
| `expires_at` | timestamptz | 발급 + 5분 |
| `created_at` | timestamptz | default now() |

---

#### MM_tutorials — 매뉴얼 메타

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` (PK) | uuid | |
| `user_id` (FK) | uuid | → MM_users.id |
| `title` | text | |
| `session_id` | text NULL | MIMIC Recorder session_id 매핑 |
| `mode` | text | 'interactive' (P1) \| 'guide' (P2) |
| `status` | text | 'draft' \| 'published' |
| `visibility` | text | 'private' \| 'public' |
| `share_token` | text NULL unique | 퍼블리시 시 |
| `output_ratio` | text | '16:9' \| '1:1' \| '9:16' |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | 트리거 |
| `published_at` | timestamptz NULL | |

---

#### MM_steps — 매뉴얼 단계

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` (PK) | uuid | |
| `tutorial_id` (FK) | uuid | → MM_tutorials (CASCADE) |
| `step_number` | int | 1부터 |
| `order_index` | int | 드래그 정렬 |
| `screenshot_url` | text | Storage URL |
| `page_url` | text NULL | 원본 페이지 |
| `ai_title` | text NULL | Claude 자동 (15자 이내) |
| `ai_description` | text NULL | Claude 자동 (40자 이내) |
| `user_title` | text NULL | 편집 결과 |
| `user_script` | text NULL | TTS 입력 |
| `created_at` | timestamptz | |

---

#### MM_markers — 마커 정보 ★ 본 제품 차별점

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` (PK) | uuid | |
| `step_id` (FK) | uuid | → MM_steps (CASCADE) |
| `marker_number` | int | 1~9 |
| `position_x` | float | 0~1 정규화 |
| `position_y` | float | 0~1 정규화 |
| `script_offset_ms` | int | 음성 내 시간 |
| `connected_effects` | jsonb | `["click_sound", "zoom_in", "typing"]` |
| `typing_text` | text NULL | P2 |
| `ai_generated` | boolean | true=AI, false=수동 |
| `created_at` | timestamptz | |

---

#### MM_annotations (Phase 2) — 도형·텍스트 주석

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` (PK) | uuid | |
| `step_id` (FK) | uuid | → MM_steps (CASCADE) |
| `marker_id` (FK) | uuid NULL | NULL=항상 표시 |
| `type` | text | 'text' \| 'arrow' \| 'rectangle' \| 'circle' \| 'underline' |
| `style` | jsonb | |
| `geometry` | jsonb | position, size |
| `show_duration_ms` | int | default 3000 |
| `created_at` | timestamptz | |

---

#### MM_audio_assets — TTS 음성 파일 메타

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` (PK) | uuid | |
| `step_id` (FK) | uuid unique | → MM_steps (CASCADE, 1:1) |
| `audio_url` | text | Storage URL |
| `duration_ms` | int | 마커 매핑용 |
| `script_text` | text | TTS 원본 |
| `voice` | text | 'nova' (기본) \| 'alloy' |
| `created_at` | timestamptz | |

---

#### MM_view_events — 시청 이벤트 로깅 (KPI)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` (PK) | uuid | |
| `tutorial_id` (FK) | uuid | |
| `viewer_session_id` | text | 익명 세션 |
| `step_number` | int NULL | |
| `event_type` | text | 'enter' \| 'step' \| 'complete' \| 'exit' |
| `timestamp` | timestamptz | |

---

#### MM_survey_responses — 종료 설문 (5문항)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` (PK) | uuid | |
| `tutorial_id` (FK) | uuid | |
| `viewer_session_id` | text | |
| `q1_easier_than_pdf` | int | 1~5 |
| `q2_would_use_again` | int | 1~5 |
| `q3_useful_for_work` | int | 1~5 |
| `q4_can_reproduce` | boolean | |
| `q5_additional_feedback` | text NULL | |
| `created_at` | timestamptz | |

---

#### MM_pro_signups ★ 검증 KPI 핵심

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` (PK) | uuid | |
| `user_id` (FK) | uuid NULL | 로그인 사용자만 |
| `email` | text | |
| `plan_interested` | text | 'pro' \| 'team' |
| `source` | text | 'landing' \| 'editor' \| 'limit_modal' \| 'mypage' |
| `created_at` | timestamptz | |

---

#### NA_steps (기존 테이블) — 보안 수정 🚨

> 현재 RLS 비활성 + user_id 없음 = 누구나 SELECT/INSERT/UPDATE/DELETE 가능
> `003_modify_na_steps.sql` 에 작성:

```sql
-- Step 1: user_id 컬럼 추가
ALTER TABLE NA_steps ADD COLUMN user_id uuid NULL;

-- Step 2: 기존 row를 정호씨 user_id로 일괄 업데이트
UPDATE NA_steps SET user_id = '정호씨_user_id'
WHERE user_id IS NULL;

-- Step 3: NOT NULL + FK
ALTER TABLE NA_steps
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT NA_steps_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Step 4: MIMIC 매뉴얼과 연결
ALTER TABLE NA_steps ADD COLUMN tutorial_id uuid NULL
  REFERENCES MM_tutorials(id) ON DELETE SET NULL;

-- Step 5: RLS 활성화
ALTER TABLE NA_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "na_steps_own" ON NA_steps
  FOR ALL USING (auth.uid() = user_id);
```

### 7-3. RLS 정책 (002_create_mm_rls.sql)

```sql
-- ─── MM_users ───
ALTER TABLE MM_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own" ON MM_users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON MM_users
  FOR UPDATE USING (auth.uid() = id);

-- ─── MM_extension_tokens ───
ALTER TABLE MM_extension_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens_own" ON MM_extension_tokens
  FOR ALL USING (auth.uid() = user_id);

-- ─── MM_tutorials ───
ALTER TABLE MM_tutorials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutorials_own" ON MM_tutorials
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "tutorials_public_share" ON MM_tutorials
  FOR SELECT USING (
    status = 'published' AND share_token IS NOT NULL
  );

-- ─── MM_steps / markers / annotations / audio_assets ───
-- (tutorial_id 통해서 소유자 확인)
ALTER TABLE MM_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "steps_own" ON MM_steps
  FOR ALL USING (
    tutorial_id IN (SELECT id FROM MM_tutorials WHERE user_id = auth.uid())
  );
CREATE POLICY "steps_public_share" ON MM_steps
  FOR SELECT USING (
    tutorial_id IN (
      SELECT id FROM MM_tutorials
      WHERE status = 'published' AND share_token IS NOT NULL
    )
  );
-- (markers, annotations, audio_assets 도 동일 패턴)

-- ─── MM_view_events ───
ALTER TABLE MM_view_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_anon_insert" ON MM_view_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "events_own_select" ON MM_view_events
  FOR SELECT USING (
    tutorial_id IN (SELECT id FROM MM_tutorials WHERE user_id = auth.uid())
  );

-- ─── MM_survey_responses ───
ALTER TABLE MM_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "survey_anon_insert" ON MM_survey_responses
  FOR INSERT WITH CHECK (true);
CREATE POLICY "survey_own_select" ON MM_survey_responses
  FOR SELECT USING (
    tutorial_id IN (SELECT id FROM MM_tutorials WHERE user_id = auth.uid())
  );

-- ─── MM_pro_signups ───
ALTER TABLE MM_pro_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pro_signups_anon_insert" ON MM_pro_signups
  FOR INSERT WITH CHECK (true);
-- SELECT는 service_role 키로만 (관리자)
```

### 7-4. 트리거 (004_create_triggers.sql)

```sql
-- auth.users INSERT 시 MM_users 자동 생성
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO MM_users (id, email, name, avatar_url, auth_provider, plan, daily_limit)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    'free',
    3
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- MM_tutorials.updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tutorials_updated_at
  BEFORE UPDATE ON MM_tutorials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 자정 KST 리셋 (Supabase Dashboard > Cron Jobs)
-- SELECT cron.schedule('reset_daily_count', '0 15 * * *', $$
--   UPDATE MM_users SET daily_manual_count = 0;
-- $$);
-- (15:00 UTC = 00:00 KST)
```

### 7-5. Storage 버킷

```
[기존 — 그대로 사용]
naviaction
  - public: ON
  - MIMIC Recorder가 직접 업로드
  - 파일 경로: {session_id}/{step_number}.jpg

[신규 — 생성 필요]
mimic-tts
  - public: ON
  - File size limit: 10MB
  - Allowed MIME types: audio/mpeg, audio/mp3
  - Policy: 인증 사용자 INSERT 가능, public SELECT
```

---

## 8. API 라우트 명세 (15개 + 1)

### 8-1. Auth (2개)

#### GET `/api/auth/callback`
- **인증**: X
- **용도**: Google OAuth 콜백 → 세션 생성 → 리다이렉트
- **응답**: 302 redirect to `/dashboard`

#### POST `/api/auth/signup-with-agreements`
- **인증**: X
- **입력 (zod)**:
  ```typescript
  {
    name: string (1~50자),
    email: string (이메일 형식),
    password: string (8자 이상),
    agreements: {
      age14: boolean (true 필수),
      terms: boolean (true 필수),
      privacy: boolean (true 필수),
      marketing: boolean (선택)
    }
  }
  ```
- **로직**:
  1. Supabase Auth `signUp()`
  2. 트리거가 생성한 MM_users row의 `agreements` JSONB 업데이트
- **응답**: `{ user, session }`

---

### 8-2. MIMIC Recorder 연동 (4개) ★ 최우선

#### POST `/api/extension/link`
- **인증**: O
- **용도**: 1회용 토큰 발급 (5분 유효)
- **응답**: `{ token: string, expiresAt: ISO8601 }`

#### POST `/api/extension/verify` (MIMIC Recorder가 호출)
- **인증**: Bearer extension token
- **용도**: 토큰을 user_id로 교환
- **로직**:
  1. `MM_extension_tokens` 에서 token + 미사용 + 미만료 확인
  2. `used_at = now()` (1회용)
- **응답**: `{ user_id, email }`

#### POST `/api/capture/analyze` (MIMIC Recorder가 호출)
- **인증**: Bearer extension token
- **입력**: `{ image: base64, url: string }`
- **로직**: Claude Vision → `{ title (15자), description (40자) }` JSON
- **응답**: `{ title, description }`

#### POST `/api/capture/save-step` (MIMIC Recorder가 호출)
- **인증**: Bearer extension token
- **입력**: `{ session_id, step_number, screenshot_url, click_x, click_y, title, description, url }`
- **로직**: NA_steps INSERT (user_id 포함, RLS 통과)
- **응답**: `{ id, step_number }`

---

### 8-3. Tutorials CRUD (6개)

#### GET `/api/tutorials`
- **인증**: O
- **응답**: `Tutorial[]` (updated_at DESC)

#### GET `/api/tutorials/[id]`
- **인증**: O
- **응답**: `TutorialDetail` (steps + markers + audio_assets)

#### PATCH `/api/tutorials/[id]`
- **인증**: O
- **입력**: 변경할 필드만
- **용도**: debounce 500ms 자동 저장
- **응답**: 변경된 row

#### DELETE `/api/tutorials/[id]`
- **인증**: O
- **응답**: 204

#### POST `/api/tutorials/[id]/publish`
- **인증**: O
- **로직**: share_token 생성 + status='published'
- **응답**: `{ share_token, share_url }`

#### GET `/api/play/[token]`
- **인증**: X (익명)
- **로직**: share_token으로 매뉴얼 + steps + markers + audio 모두 SELECT
- **응답**: `TutorialDetail` (public)

---

### 8-4. AI 생성 (4개)

#### POST `/api/generate-script`
- **인증**: O
- **입력**: `{ steps: Step[], userDraft?: string }`
- **로직**: Claude → 한국어 TTS용 스크립트, 마커 ①②③ 보존
- **응답**: `{ script: string, markerPositions: number[] }`
- **응답 시간 목표**: < 8초

#### POST `/api/generate-markers`
- **인증**: O
- **입력**: `{ steps: Step[] }`
- **로직**: Claude → AI 자동 마커 배치

**프롬프트:**
```
다음 매뉴얼 데이터를 보고 ①②③ 마커를 자동으로 배치해줘.

스텝 목록:
{steps에 대한 title, description, page_url, click_x, click_y, screenshot_url}

규칙:
- 모든 클릭 위치 = 마커 후보
- 너무 가까운 클릭은 하나로 묶기
- 사용자 시선 흐름 자연스럽게 (좌→우, 위→아래)
- 마커 번호는 시간 순서대로

응답 형식 (JSON만):
{
  "markers": [
    {
      "step_id": "uuid",
      "marker_number": 1,
      "position_x": 0.18,
      "position_y": 0.38,
      "connected_effects": ["click_sound"]
    }
  ]
}
```
- **응답**: `{ markers: Marker[] }`
- **응답 시간 목표**: < 10초

#### POST `/api/generate-annotations`
- **인증**: O
- **입력**: `{ stepId: uuid, userPrompt: string }`
- **로직**: 사용자 프롬프트 → Claude → annotations 배열
- **응답**: `{ annotations: Annotation[] }`

#### POST `/api/tts`
- **인증**: O
- **입력**: `{ stepId: uuid, scriptText: string, voice?: 'nova' | 'alloy' }`
- **로직**:
  1. OpenAI TTS (`tts-1`, voice `nova`) 호출
  2. mp3 Buffer → Supabase Storage (`mimic-tts` 버킷) 업로드
  3. duration 계산
  4. `MM_audio_assets` UPSERT
- **응답**: `{ audio_url, duration_ms }`
- **응답 시간 목표**: < 6초
- **Fallback**: 실패 시 클라이언트 `SpeechSynthesisUtterance` 사용

---

### 8-5. Events + Survey + Signup (4개)

#### POST `/api/events`
- **인증**: X
- **입력**: `{ tutorial_id, viewer_session_id, event_type, step_number? }`
- **응답**: 204

#### POST `/api/survey`
- **인증**: X
- **입력**: 5문항 결과
- **응답**: 204

#### POST `/api/pro-signup` ⭐ 검증 KPI 핵심
- **인증**: X
- **입력**: `{ email, plan_interested, source, userId? }`
- **로직**:
  1. 중복 체크 (같은 이메일 + 같은 plan 거부)
  2. INSERT
- **응답**: `{ success: true, message: "사전예약 완료" }`

#### GET `/api/admin/pro-signups` (Phase 2)
- **인증**: O + admin role
- **응답**: `ProSignup[]`

---

## 9. 클라이언트용 라이브러리 (디자인이 호출)

### lib/auth-client.ts
```typescript
export async function signInWithGoogle(): Promise<void>
export async function signInWithEmail(email: string, password: string): Promise<{ user, session }>
export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
  agreements: Agreements
): Promise<{ user, session }>
export async function signOut(): Promise<void>
export async function resetPassword(email: string): Promise<void>
export async function getCurrentUser(): Promise<User | null>
```

### lib/api/tutorials.ts
```typescript
export async function getTutorials(): Promise<Tutorial[]>
export async function getTutorial(id: string): Promise<TutorialDetail>
export async function updateTutorial(id: string, patch: Partial<Tutorial>): Promise<Tutorial>
export async function deleteTutorial(id: string): Promise<void>
export async function publishTutorial(id: string): Promise<{ share_token, share_url }>
export async function getPublicTutorial(token: string): Promise<TutorialDetail>
```

### lib/api/ai.ts
```typescript
export async function generateScript(steps: Step[], userDraft?: string): Promise<{ script, markerPositions }>
export async function generateMarkers(steps: Step[]): Promise<Marker[]>
export async function generateAnnotations(stepId: string, prompt: string): Promise<Annotation[]>
export async function generateTTS(stepId: string, script: string): Promise<{ audio_url, duration_ms }>
```

### lib/api/events.ts
```typescript
export async function logEvent(event: ViewEvent): Promise<void>
export async function submitSurvey(survey: SurveyData): Promise<void>
export async function signupForPro(data: ProSignupData): Promise<void>
```

### lib/api/extension.ts
```typescript
export async function requestExtensionLink(): Promise<{ token, expiresAt }>
export async function sendTokenToExtension(token: string): Promise<boolean>
// chrome.runtime.sendMessage(EXTENSION_ID, { action: 'LINK_USER', token })
```

### lib/mocks.ts (디자인 작업용)
```typescript
export const MOCK_USER: User = { ... }
export const MOCK_TUTORIALS: Tutorial[] = [ ... ]
export const MOCK_STEPS: Step[] = [ ... ]
export const MOCK_MARKERS: Marker[] = [ ... ]
```

---

## 10. 타입 정의 (`types/index.ts`)

> 디자인이 mock 데이터 만들 때 참조하므로 **가장 먼저** 작성.

```typescript
// ─────────────────────────────
// User
// ─────────────────────────────
export type User = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  auth_provider: 'email' | 'google';
  plan: 'free' | 'pro_waitlist' | 'pro' | 'team';
  daily_manual_count: number;
  daily_limit: number;
  agreements: Agreements;
  created_at: string;
};

export type Agreements = {
  age14: boolean;
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
  agreed_at: string;
};

// ─────────────────────────────
// Tutorial
// ─────────────────────────────
export type Tutorial = {
  id: string;
  user_id: string;
  title: string;
  session_id: string | null;
  mode: 'interactive' | 'guide';
  status: 'draft' | 'published';
  visibility: 'private' | 'public';
  share_token: string | null;
  output_ratio: '16:9' | '1:1' | '9:16';
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type TutorialDetail = Tutorial & {
  steps: Step[];
  markers: Marker[];
  audio_assets: AudioAsset[];
  annotations?: Annotation[];
};

// ─────────────────────────────
// Step / Marker / Annotation
// ─────────────────────────────
export type Step = {
  id: string;
  tutorial_id: string;
  step_number: number;
  order_index: number;
  screenshot_url: string;
  page_url: string | null;
  ai_title: string | null;
  ai_description: string | null;
  user_title: string | null;
  user_script: string | null;
  created_at: string;
};

export type Marker = {
  id: string;
  step_id: string;
  marker_number: number;       // 1~9
  position_x: number;          // 0~1
  position_y: number;          // 0~1
  script_offset_ms: number;
  connected_effects: Array<'click_sound' | 'zoom_in' | 'typing'>;
  typing_text: string | null;
  ai_generated: boolean;
  created_at: string;
};

export type Annotation = {
  id: string;
  step_id: string;
  marker_id: string | null;
  type: 'text' | 'arrow' | 'rectangle' | 'circle' | 'underline';
  style: Record<string, unknown>;
  geometry: Record<string, unknown>;
  show_duration_ms: number;
  created_at: string;
};

// ─────────────────────────────
// Audio / Events / Pro Signup
// ─────────────────────────────
export type AudioAsset = {
  id: string;
  step_id: string;
  audio_url: string;
  duration_ms: number;
  script_text: string;
  voice: 'nova' | 'alloy';
  created_at: string;
};

export type ViewEvent = {
  tutorial_id: string;
  viewer_session_id: string;
  event_type: 'enter' | 'step' | 'complete' | 'exit';
  step_number?: number;
};

export type SurveyData = {
  tutorial_id: string;
  viewer_session_id: string;
  q1_easier_than_pdf: 1 | 2 | 3 | 4 | 5;
  q2_would_use_again: 1 | 2 | 3 | 4 | 5;
  q3_useful_for_work: 1 | 2 | 3 | 4 | 5;
  q4_can_reproduce: boolean;
  q5_additional_feedback?: string;
};

export type ProSignupData = {
  email: string;
  plan_interested: 'pro' | 'team';
  source: 'landing' | 'editor' | 'limit_modal' | 'mypage';
  user_id?: string;
};
```

---

## 11. middleware.ts

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED = ['/dashboard', '/editor', '/mypage', '/extension-link', '/settings']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|auth/callback).*)'],
}
```

---

## 12. 보안 체크리스트

### 🚨 Critical (위반 시 보안 사고)
- [ ] `.env.local` 이 `.gitignore` 에 포함
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 는 API Route 에서만 import
- [ ] API 키 하드코딩 0건 (모두 `process.env`)
- [ ] 모든 테이블 RLS 활성화 (NA_steps 포함)
- [ ] Claude / OpenAI API 호출은 백엔드 경유만
- [ ] CORS — `chrome-extension://<MIMIC_EXTENSION_ID>` origin 만 허용

### 🟡 Important
- [ ] 모든 API Route 에 zod 입력 검증
- [ ] 모든 API Route 에 인증 가드 (`lib/auth-guard.ts`)
- [ ] Rate Limiting (특히 AI API — 1분당 10회 / 사용자)
- [ ] 파일 업로드 검증 (MIME, 크기 5MB 이하)
- [ ] SQL Injection 방지 — Supabase client 만 사용, raw query 금지

### 🟢 Recommended
- [ ] AI API 호출 비용 모니터링 로직
- [ ] TTS 실패 시 클라이언트 Fallback (`SpeechSynthesisUtterance`)
- [ ] 환경변수 검증 함수 (앱 시작 시)
- [ ] 에러 로깅 (Vercel Logs 기본 OK)

---

## 13. 작업 순서 (의존성 기준)

```
1단계: 프로젝트 셋업
  ├ Next.js 14 프로젝트 생성 (mimic/)
  ├ 패키지 설치 (위 5번)
  ├ shadcn/ui 초기화
  └ .env.local 작성

2단계: 타입 정의 ★ 가장 먼저
  ├ types/index.ts
  ├ types/api.ts
  └ types/database.ts (npx supabase gen types)

3단계: DB 마이그레이션
  ├ 001_create_mm_tables.sql
  ├ 002_create_mm_rls.sql
  ├ 003_modify_na_steps.sql  ★ CRITICAL
  ├ 004_create_triggers.sql
  └ Storage 버킷 mimic-tts 생성

4단계: Supabase 클라이언트 + 인증
  ├ lib/supabase/client.ts
  ├ lib/supabase/server.ts
  ├ middleware.ts
  ├ lib/auth-client.ts
  ├ lib/auth-guard.ts
  └ app/api/auth/callback/route.ts

5단계: AI/외부 API 래퍼
  ├ lib/claude.ts
  ├ lib/openai-tts.ts
  ├ lib/markers.ts
  └ lib/validators.ts

6단계: API Routes (15개+)
  ├ extension (4개)  ★ 최우선
  ├ tutorials (6개)
  ├ AI (4개)
  └ events / survey / pro-signup (3개)

7단계: 클라이언트 라이브러리
  ├ lib/api/tutorials.ts
  ├ lib/api/ai.ts
  ├ lib/api/events.ts
  └ lib/api/extension.ts

8단계: Mock 데이터 (디자인용)
  └ lib/mocks.ts

9단계: 디자인 핸드오프 통합
  ├ 디자인이 만든 page.tsx, components/* 받아서 통합
  ├ Mock 데이터를 실제 API 호출로 교체
  └ E2E 테스트

10단계: 배포 검증
  ├ Vercel 환경변수 등록 (8개)
  ├ Redeploy
  └ 프로덕션 E2E
```

---

## 14. Phase 1 완료 체크리스트

### 🟣 프로젝트 셋업
- [ ] Next.js 14 프로젝트 생성
- [ ] 모든 패키지 설치
- [ ] shadcn/ui 초기화 + 컴포넌트 추가
- [ ] `.env.local` 작성 + `lib/env.ts` 검증

### 🟣 타입 정의
- [ ] `types/index.ts`
- [ ] `types/api.ts`
- [ ] `types/database.ts` (Supabase 자동생성)

### 🚨 DB 마이그레이션
- [ ] MM_users + 트리거
- [ ] MM_extension_tokens
- [ ] MM_tutorials
- [ ] MM_steps
- [ ] MM_markers
- [ ] MM_annotations
- [ ] MM_audio_assets
- [ ] MM_view_events (익명 INSERT)
- [ ] MM_survey_responses (익명 INSERT)
- [ ] MM_pro_signups (익명 INSERT)
- [ ] NA_steps 보안 수정 + RLS
- [ ] Storage 버킷 `mimic-tts` 생성
- [ ] 모든 RLS 정책 활성화

### 🟣 API Routes (15개+)
- [ ] `/api/auth/callback`
- [ ] `/api/auth/signup-with-agreements`
- [ ] `/api/extension/link`
- [ ] `/api/extension/verify`
- [ ] `/api/capture/analyze`
- [ ] `/api/capture/save-step`
- [ ] `/api/tutorials` (GET)
- [ ] `/api/tutorials/[id]` (GET/PATCH/DELETE)
- [ ] `/api/tutorials/[id]/publish` (POST)
- [ ] `/api/play/[token]` (GET, 익명)
- [ ] `/api/generate-script`
- [ ] `/api/generate-markers`
- [ ] `/api/generate-annotations`
- [ ] `/api/tts`
- [ ] `/api/events` (익명)
- [ ] `/api/survey` (익명)
- [ ] `/api/pro-signup` (익명, ⭐ 검증 핵심)

### 🟣 클라이언트 라이브러리
- [ ] `lib/supabase/client.ts`
- [ ] `lib/supabase/server.ts`
- [ ] `lib/auth-client.ts`
- [ ] `lib/auth-guard.ts`
- [ ] `lib/api/tutorials.ts`
- [ ] `lib/api/ai.ts`
- [ ] `lib/api/events.ts`
- [ ] `lib/api/extension.ts`
- [ ] `lib/claude.ts`
- [ ] `lib/openai-tts.ts`
- [ ] `lib/markers.ts`
- [ ] `lib/validators.ts`
- [ ] `lib/mocks.ts` (디자인용)
- [ ] `lib/env.ts`

### 🟣 미들웨어
- [ ] `middleware.ts`

### 🚨 보안 통과
- [ ] Critical 6건 모두 통과
- [ ] Important 5건 통과
- [ ] 김정호 검수 → 머지

### 🟣 배포 검증
- [ ] Vercel 환경변수 8개 등록
- [ ] Redeploy 정상
- [ ] 프로덕션 E2E 시나리오 통과
  - 가입 → MIMIC Recorder 연결 → 캡처 → 에디터 → 플레이어 → 설문

---

## 15. 디자인 핸드오프 받는 방법

### 받을 자산
- `app/page.tsx` (랜딩)
- `app/(auth)/login/page.tsx`, `signup/page.tsx`
- `app/(dashboard)/dashboard/page.tsx`, `mypage/page.tsx`, `settings/page.tsx`, `extension-link/page.tsx`
- `app/editor/[id]/page.tsx`
- `app/play/[token]/page.tsx`
- `app/legal/terms/page.tsx`, `privacy/page.tsx`
- `components/landing/*`, `dashboard/*`, `editor/*`, `player/*`, `modals/*`
- `app/globals.css` (디자인 토큰 + Pretendard 폰트)
- `tailwind.config.ts`

### 통합 작업
1. 디자인이 사용한 mock 데이터를 실제 API 호출로 교체
   - `MOCK_TUTORIALS` → `await getTutorials()`
   - `MOCK_USER` → `await getCurrentUser()`
2. 디자인이 직접 fetch 한 부분 있으면 `lib/api/*` 함수로 교체
3. 이벤트 핸들러 (로그인 버튼 → `signInWithGoogle()`) 연결
4. 로딩/에러 상태 UI 보강
5. **MIMIC Recorder 연동 흐름 검증**:
   - 웹에서 `/extension-link` 진입
   - `requestExtensionLink()` 호출 → 토큰 받기
   - `chrome.runtime.sendMessage(EXTENSION_ID, { action: 'LINK_USER', token })`
   - 확장이 받아서 저장 → 캡처 시 토큰 첨부

### 디자인이 절대 건드리지 않을 것 (보존 약속)
- `lib/`, `types/`, `app/api/`, `supabase/`, `middleware.ts`, `.env.*`
- 즉 위에서 정의한 책임 범위 외 모든 것

---

**MIMIC · Backend Build Specification v3.0 · 2026.05.26**
**Don't Explain, Just Mimic.**
**작성: 클로드 (코마인드웍스 김정호 의뢰)**

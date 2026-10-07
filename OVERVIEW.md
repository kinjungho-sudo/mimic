# Parro — 프로젝트 총괄 개요

> **AI Live Guide for hands-on training.**
> 말로 설명하지 마세요. 화면 위에서 따라할 수 있는 AI 라이브 가이드로 만들어드립니다.

최종 갱신: 2026-10-08. 저장소 이름과 `mimic_*` 경로는 호환용 내부 식별자이고, 제품 이름은 Parro다.

---

## 서비스 본질

팀원이나 고객에게 소프트웨어 사용법을 전달할 때, PDF·Loom·말 대신 **클릭 한 번으로 따라할 수 있는 가이드**를 만드는 도구.
캡처 → AI 처리 → 편집 → 공유(학습 가이드·Live Guide Beta·플레이북)를 하나의 흐름으로 제공한다.

---

## 디렉토리 구조

```
parro/                       ← 공식 로컬 체크아웃 (D:\project\dev\parro)
  ├── mimic_app/             ← Next.js 웹 서비스 + API (Vercel)
  ├── mimic_recorder/        ← Chrome 확장 Parro Recorder (캡처·Live Guide)
  ├── mimic_desktop/         ← Desktop Companion (Native Messaging host + Windows 캡처 에이전트)
  ├── packages/mcp-server/   ← 매뉴얼을 Claude 에이전트에 노출하는 MCP 서버
  ├── scripts/               ← 워크스페이스 검증·dev Recorder 배포 스크립트
  └── docs/                  ← 인수인계·조치 계획 등 저장소 공통 문서
```

## 구성 요소

| 구성 요소 | 역할 | 검증 명령 (`mimic_app`에서) |
|---|---|---|
| `mimic_app` | 캡처 데이터 → AI 매뉴얼 생성, 편집기, 공유 화면(`/play`, `/p`, `/embed`), 관리자 | `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` |
| `mimic_recorder` | 클릭·입력 감지, 스크린샷 업로드, Live Guide 오버레이 | `npm.cmd run verify:recorder-profile`, `verify:live-guide`, `verify:recorder-store-package` |
| `mimic_desktop` | 브라우저 밖 Windows 화면 캡처, 설치 마법사·런처 | `npm.cmd run verify:desktop` |
| `packages/mcp-server` | 소유자 매뉴얼 조회·실행 결과 기록 (service-role) | `npx tsc --noEmit` (패키지 폴더에서) |

## 전체 파이프라인

```
[웹앱] 로그인 → /extension-link 에서 1회용 링크 토큰 발급
[Recorder] 링크 토큰 → POST /api/extension/redeem → 30일 세션 토큰
[Recorder] 녹화 → /api/capture/upload-target 으로 Storage 업로드 → /api/capture/save-step
[Recorder] 완료 → POST /api/capture/finalize → AI 제목·설명 생성, 매뉴얼(초안) 생성
[웹앱] 편집기에서 다듬기·음성(TTS) → 게시 시 share_token 발급
[시청자] /play/[token] (비밀번호 보호 시 잠금 해제 후 Live Guide·PDF 접근 증명 발급)
[Desktop] Recorder → Native Host → 캡처 에이전트 → 완료 후 연결된 웹앱 /desktop-import
```

## 인프라

| 항목 | 값 |
|---|---|
| 운영 웹앱 | `https://parro-guide.vercel.app` (`main` push → Production) |
| 개발 웹앱 | `https://parro-guide-dev.vercel.app` (`dev` push → Preview) |
| 운영 DB | Supabase `gqynptpjomcqzxyykqic` (Parro 외 앱의 함수도 함께 있음 — 건드리지 말 것) |
| 개발 DB | 별도 Supabase 계정의 dev 프로젝트 (`mimic_app/DEV_PROCESS.md` 참조) |
| 스키마 기준 | `mimic_app/supabase/dev-setup/01_mimic_dev_schema.sql` + 이후 타임스탬프 마이그레이션 |
| Native Messaging host | `com.mimic.desktop_companion.dev` (호환용 고정 식별자) |

## 요금제 (기준: `mimic_app/lib/product-plans.ts`, `lib/entitlements.ts`)

| 플랜 | 가격 | 핵심 |
|---|---|---|
| Free | ₩0 | 매일 매뉴얼 3개 |
| Basic | ₩9,900/월 | AI 다듬기, PPTX·Word, 비밀번호 보호, 매뉴얼 무제한 |
| Pro | ₩19,900/월 | Desktop Companion, Live Guide Beta, AI 음성, 브랜드 표기 |
| Team | 협의 | 팀 워크스페이스 |

결제(PG) 연동은 아직 없다. 플랜은 관리자가 `/admin`에서 변경한다.

## 문서 지도

| 문서 | 내용 |
|---|---|
| `mimic_app/docs/DEV_PROCESS.md` | 브랜치·검증·배포 순서 (기준 문서) |
| `mimic_app/DEV_PROCESS.md` | DB 분리·환경변수·worktree 상세 |
| `docs/development/claude-code-handoff.md` | Claude Code 이관 스냅샷 |
| `docs/development/remediation-plan-2026-10.md` | 2026-10 보안·품질 조치 계획과 진행 상태 |
| `mimic_app/docs/PLAN.md` | 백엔드 설계서 v3 (2026-05, 이력) |
| `Plan.md`, `MIMIC_*.md` | 2026-06 제품 설계 이력 (요금·명칭은 위 표가 우선) |

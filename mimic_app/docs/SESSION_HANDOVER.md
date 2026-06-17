# 세션 인수인계서 (2026-06-15 / 업데이트 2)

> 다음 세션이 바로 이어갈 수 있도록 정리. 완료 후 삭제 무방.

## 현재 상태 (깨끗함)
- 브랜치: `dev` = `main` = `origin/main` = **3b60d2f**
- 미커밋 변경: 없음 (.playwright-mcp 로그·스크린샷 등 추적 안 된 잡파일만 남음)
- 프로덕션 배포: **READY** (`mimic-nine-ashen.vercel.app` — 이게 실제 운영 도메인. mimicflow.com은 미연결 GoDaddy 파킹 상태로 앱과 무관)
- 빌드: `NODE_OPTIONS="--use-system-ca" npm run build` 통과
- 이후 커밋: b52a180(문의메일→Gmail), 3b60d2f(스튜디오 저장 stale-closure fix), df62079(스튜디오 1~3 고도화)
- **스튜디오 저작→저장→DB 왕복 + 1~3 고도화 프로덕션 실검증 완료** (테스트 데이터 정리함)

### 스튜디오 1~3 고도화 (df62079, 배포·검증 완료)
- **인디케이터 종류 '없음'(none) 추가** — 자동/클릭/텍스트/없음 2×2. none이면 핫스팟 미표시 + 하단 말풍선 + '다음'으로만 진행. types/zod/`lib/follow.ts` resolver 모두 반영(none→hotspot null 강제)
- **`components/viewer/FollowStage.tsx` 신설** — 이미지+인디케이터+말풍선 시각 레이어 공용 컴포넌트. InteractiveFollowPlayer와 스튜디오 캔버스가 **동일 컴포넌트**를 써서 WYSIWYG(실제 보일 모습 그대로). 스튜디오는 실제 인디케이터 위에 투명 드래그 링을 children으로 얹어 위치 편집
- **Tango식 텍스트 인디케이터** — 입력 필드 박스 + 깜빡 커서 + '⌨ 입력' 라벨 + 글로우 펄스(`mfp-field`)
- Mascot/CORNER는 FollowStage에서 export → 플레이어가 import

## 이번 세션 완료: 따라하기 스튜디오 본 구현 (배포됨)

따라하기 뷰어는 완성돼 있었으나 저작 도구가 없어 핫스팟·click/type·문구가 전부 **자동추론**이었음 → 제작자가 직접 저작하는 **별도 /studio 라우트** 신설.

### DB
- `mm_steps.follow_config jsonb` **nullable 컬럼 추가** (프로덕션=project1=gqynptpjomcqzxyykqic에 마이그레이션 적용 완료)
- 형태: `{ hotspotX, hotspotY (0~100 pct), kind: 'click'|'type', instruction: text, hidden: bool }`. 필드 미설정/null = 자동추론. 빈 객체는 null로 정규화 저장
- ⚠️ project2(도쿄)는 MIMIC DB 아님 — 마이그레이션은 항상 project1

### 코드
- **`lib/follow.ts`** (신규) — 공용 resolver. `toFollowSteps(FollowSource[])`: follow_config 오버라이드 + hidden 필터 + 자동추론 폴백. `inferKind`, `clickToPct` 포함. **manual·play 따라하기 호출부가 이걸 공유**(휴리스틱 중복 제거)
- **`app/manual/[id]/studio/page.tsx`** (신규) — 좌:스텝리스트 / 중앙:캔버스(이미지 클릭·점 드래그로 핫스팟 지정) / 우:속성패널(표시·숨김 토글, 종류 자동/클릭/입력, 핫스팟 녹화값 초기화, 안내문구 textarea). 변경 즉시 `updateStep`으로 저장(저장중/저장됨 인디케이터). 상단 '미리보기'로 InteractiveFollowPlayer 즉시 확인. viewer 역할은 차단
- **백엔드**: `PATCH /api/steps/[id]` zod에 `follow_config` 추가 + select 반영, `updateStep` 클라이언트 시그니처 확장
- **타입**: `types/index.ts`에 `FollowConfig` + `Step.follow_config`
- **진입점**: 매뉴얼 페이지 헤더에 '스튜디오' 버튼(`canEdit`만, 미리보기 옆)

### 좌표계 (변동 없음)
- click_x/y DB 0~1(레거시 0~10000 혼재) → `clickToPct`로 0~100 → 플레이어 0~100% 입력
- follow_config.hotspotX/Y는 **이미 0~100 pct로 저장**(스튜디오에서 변환해 기록)

### 라이브 가이드 (구 Guide Me) — 리네이밍 + 유료 게이팅 (배포·검증 완료)
- **리네이밍**: 사용자 노출 'Guide Me' → '라이브 가이드' 일괄(manual/editor/help/landing/agent-chat/faq/sdk). 기술 식별자(mimic_guide·data-guide·guide-engine.js·내부 var)는 유지. 기능 삭제된 적 없음(그대로 유지)
- **유료 게이팅 (제작자 과금, Free 누적 5회)**:
  - `mm_users.live_guide_runs` 카운터(마이그레이션 적용). pro/team/enterprise=무제한
  - `/api/guide/[token]`: 소유자 plan 확인 → free 누적 5회까지 1회씩 차감 후 서빙, 초과 시 `{gated:true, limit, upgradeUrl}` (steps 미반환)
  - `GET /api/user/plan`: plan + 라이브가이드 잔여(페이월 UI용)
  - 매뉴얼 페이지: 소유자에게 '무료 N회'/'체험 종료' 뱃지 + 한도 시 업그레이드 모달(→ /settings)
  - 익스텐션 background.js: gated 처리(미시작) — ⚠️ **익스텐션은 재배포(zip 갱신) 해야 반영**. 서버 게이트는 구버전도 안전 차단
  - 프로덕션 검증 완료: free+5→gated / free+2→serve+카운트 2→3 / 뱃지·모달 정상. 테스트 후 소유자 계정 pro/0 복원
- **공유메일 발송**: Resend 포기 → **n8n 웹훅(Webhook→Gmail) 전환** (app/api/share/email). 앱이 완성 HTML을 `N8N_SHARE_EMAIL_WEBHOOK_URL`로 POST. env 미설정이라 현재 503(안전 실패). **사용자 액션 필요**: n8n 인스턴스 실행 + 워크플로우 임포트 + Gmail OAuth 연결 + 웹훅 URL을 Vercel env(N8N_SHARE_EMAIL_WEBHOOK_URL, 선택 N8N_SHARE_EMAIL_SECRET)에 설정 → 재배포. 가이드·임포트 JSON: `mimic_app/N8N_EMAIL_SETUP.md`. 설정 후 공유 모달>이메일 탭으로 검증

## 다음 작업 후보 (우선순위)
1. **실화면 Guide Me 유료 게이팅** — 플랜(isPro) 기반 무료 N회 후 페이월. guide-engine.js + /api/extension/me 존재
2. **스튜디오 고도화** — 스텝 순서 변경/추가, 핫스팟 '없음(다음으로만)' 명시 토글, 따라하기 전용 음성 재녹음, 다중 핫스팟
3. **소프트게이트 v1 개선** — 로그인 복귀 시 위치 복원(?resume=N 또는 localStorage). 현재 idx 0부터 재시작

## 작업 규칙 리마인더
- `dev`에서 작업 → 커밋 → 배포 시 `main` 병합 + `git push origin main`(자동배포) → `dev` 복귀
- 배포 후 Vercel MCP `get_deployment`(teamId=team_xZNq0Dux2CuYSqwtgHmjK5vL)로 state=READY 확인. curl은 `-k` 필요(SSL 인터셉트)
- DB 마이그레이션은 project1(gqynptpjomcqzxyykqic)에만. prod에 테스트 데이터 INSERT 금지(스키마 변경은 허용)

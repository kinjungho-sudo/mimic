# Parro 개발 프로세스 가이드 (필수)

> 로컬 개발 → 검증 → 배포까지 **반드시 이 순서·규칙을 따른다.** 모든 에이전트/작업자 공통.
> 최종 갱신: 2026-06-22 (dev 전용 DB 신설 반영). 이전 "dev=project2" 기술은 폐기됨.

---

## 0. 개발 명령 수신 시 첫 동작 — dev 최신화 먼저 (자동, 매번)

> 🔁 **사용자가 개발(코딩/수정/취합)을 요청하면, 작업 시작 전에 항상 dev 최신 여부를 먼저 확인하고, 뒤처져 있으면 최신화부터 한 뒤 명령을 수행한다.** 사용자가 매번 "최신화해줘"라고 말하지 않아도 알아서 한다.

```bash
git fetch origin                         # 1) 원격 최신 받아오기
git rev-list --count HEAD..@{u}          # 2) 현재 브랜치가 upstream보다 뒤처졌는지 확인 (>0 이면 뒤처짐)
# feat/* 인스턴스: dev 대비 뒤처짐도 확인
git rev-list --count HEAD..origin/dev    #    (>0 이면 dev 최신화 필요)
git pull --rebase origin <현재브랜치>     # 3) 뒤처졌으면 최신화 (feat은 git rebase origin/dev)
```

- **순서:** ① fetch → ② 뒤처짐 판정 → ③ 뒤처졌으면 rebase/pull로 최신화 → ④ 그 다음 요청 작업 수행.
- 이미 최신이면 ③ 생략하고 바로 작업. (불필요한 pull로 시간 낭비 안 함)
- rebase 중 **충돌**나면 멈추고 사용자에게 알린 뒤 정리. 함부로 진행하지 않음.
- 커밋·푸시는 여전히 **시킬 때만**. 최신화(fetch/rebase)는 작업 정확성을 위한 사전 동작이라 자동 수행 OK.

---

## 1. DB 구조 (dev / 운영 완전 분리)

```
┌───────────────────────────────────────────────────────────────┐
│  로컬(npm run dev)  +  Vercel Preview(dev 브랜치)               │
│   → 개발 전용 DB:  dskphgxurxebblnpwhax  (도쿄)                 │
│   → Parro 전용 깨끗한 프로젝트. 테스트 데이터 자유.             │
└───────────────────────────────────────────────────────────────┘
              ↕  완전 분리 (데이터 공유 없음)
┌───────────────────────────────────────────────────────────────┐
│  Vercel Production(main 브랜치)                                 │
│   → 운영 DB:  gqynptpjomcqzxyykqic  (싱가포르) = project1       │
│   → 실제 서비스. 테스트 데이터 절대 금지.                       │
└───────────────────────────────────────────────────────────────┘
```

| 환경 | 코드 | 연결 DB |
|------|------|---------|
| 로컬 `npm run dev` | dev | **dev DB**(dskphg…) ← `.env.development.local` |
| Vercel **Preview**(dev push) | dev | **dev DB**(dskphg…) ← Vercel Preview 스코프 env |
| Vercel **Production**(main push) | main | **운영 DB**(project1) ← Vercel Production 스코프 env |

- **dev DB는 별도 Supabase 계정**(kinjungho0870@gmail.com)에 있음 → Claude의 Supabase MCP로는 **접근 불가**. 조작은 ① 대시보드 **SQL Editor**, 또는 ② service_role 키로 REST/Admin API.
- 운영 DB(project1)는 기존 계정 MCP로 접근 가능.
- dev 스키마 정의: [`supabase/dev-setup/01_mimic_dev_schema.sql`](supabase/dev-setup/01_mimic_dev_schema.sql) (운영 라이브 구조에서 추출). ⚠️ `supabase/migrations/*`는 운영과 어긋나 신뢰 불가 — **운영 라이브 구조가 진실**.
- 옛 공유 dev(project2, xsfriegbpygydcqhsqqq)는 **폐기** — MIMIC mm_* 정리됨. 그 프로젝트의 타 앱 표는 건드리지 말 것.

### dev 테스트 계정
`test@naver.com` / `Devtest1234` (이메일 인증 완료). 새 dev 프로젝트 대시보드 Authentication에서 관리.

---

## 2. 환경변수

```
mimic_app/
├── .env.local                # 운영 DB(project1) 키 — fallback
└── .env.development.local    # dev DB(dskphg…) 키 — npm run dev 전용, gitignore됨 ✅
```

Next.js 우선순위: `npm run dev` 시 **`.env.development.local`(dev DB)** 가 `.env.local`보다 우선 → 아무것도 안 바꿔도 로컬은 dev DB 사용.

> ⚠️ `NEXT_PUBLIC_*` 변수는 **빌드 시 코드에 박힌다(inline)**. Vercel에서 값을 바꿨으면 **반드시 재빌드(재배포)** 해야 적용됨.
> ⚠️ Vercel 환경변수는 **Development / Preview / Production 3스코프**가 따로다. Preview만 dev DB, Production은 운영 DB로 분리돼 있음 — Production 값을 건드리지 말 것.

---

## 3. Git 워크플로우 — 작업 유형 먼저 판단

> 명령(요청) 전에 정한다: **"개별 작업인가, 공통 작업인가?"**

### ① 개별 작업 (서로 무관 · 멀티 인스턴스 병렬)
- 서로 영향 없는 여러 작업을 동시에 → 인스턴스(브라우저) 여러 개 + **worktree**로 폴더 분리.
- 영역(담당 범위): **editor**(편집기 + **홈 `/home`**) / **api** / **recorder** / **landing**(랜딩 + **관리자 `/admin`**) — 각자 `feat/*` 브랜치.

### ② 공통 작업 (교차 관심사 · 단일 인스턴스 + 서브에이전트)
- 다국어·로깅처럼 **전 영역을 가로지르는 하나의 작업** → 한 인스턴스에서 명령, 서브에이전트가 영역별 분담.
- 진행 중엔 개별 작업을 멈춘다(충돌 위험).

### 3층 브랜치 구조
```
feat/*   ← 각자 '쓰는' 곳 (feat/editor·api·recorder·landing)
  │ 합치기
dev      ← '모으는' 통합 브랜치 (여기서 직접 코딩 안 함)
  │ 검증 후 배포
main     ← 운영 (push 시 Vercel Production 자동 배포)
```

### 통합 규칙 (충돌 예방의 핵심)
1. `dev`는 통합 전용 — 직접 코딩 X.
2. **push 전 항상** `git pull --rebase`(또는 `git rebase origin/dev`) → "non-fast-forward 거부" 예방.
3. 작게 자주 커밋. 컨텍스트 전환 시 미커밋 상태로 두지 않기.
4. **main 배포는 한 명(총괄)만.**
5. 같은 파일을 둘이 동시에 만지지 않기(영역 분할).

### worktree (멀티 인스턴스용)
```
C:/.../Dev/mimic            [dev]          ← 통합/배포 총괄
C:/.../Dev/mimic-editor     [feat/editor]
C:/.../Dev/mimic-api        [feat/api]
C:/.../Dev/mimic-recorder-wt[feat/recorder]
C:/.../Dev/mimic-landing    [feat/landing]
```
- 인스턴스마다 폴더 하나 → 파일 쓰기 충돌 원천 차단.
- **worktree 첫 사용 시** 각 폴더의 `mimic_app`에서 `npm install` 1회 필요(node_modules 비공유). `.env*.local`은 복사돼 있음.

### feat 인스턴스 실전 절차 (복붙 프롬프트)
1. `너 지금 editor 브랜치 맞는지 확인해줘`
2. `작업 전에 dev 최신으로 맞춰줘` (rebase)
3. `에디터에 ○○ 기능 추가해줘`
4. `완료됐으면 빌드 확인하고 커밋해줘` ← 커밋·푸시는 **시켜야** 실행됨
5. `문제없으면 dev 최신 한 번 더 맞춰서 푸시까지 해줘`
→ 이후 **총괄**이 `feat/* → dev` 취합 → 검증 → `dev → main` 배포.

---

## 4. 개발 → 배포 표준 순서

```bash
# Step 1. 로컬 개발 (dev DB 연결)
NODE_OPTIONS="--use-system-ca" npm run dev      # --use-system-ca 필수(SSL 인터셉트 환경)

# Step 2. dev 커밋·푸시 → Vercel Preview(=dev DB) 자동 배포
git add <파일>; git commit -m "feat: ..."; git push origin dev

# Step 3. 빌드 검증 (실패 시 절대 배포 금지)
NODE_OPTIONS="--use-system-ca" npm run build

# Step 4. 운영 배포 (총괄만)
git checkout main && git pull origin main && git merge dev
npm run build                                    # 한 번 더 확인
git push origin main                             # → Vercel Production(운영 DB) 자동 배포
git checkout dev                                 # 복귀
```
- 배포 후 **state=READY** 확인 + 운영 도메인 라우트 동작 검증 필수.
- Preview는 이제 dev DB를 보므로, 운영 영향 없이 안전하게 검증 가능.

---

## 5. 스키마(DB 구조) 변경 — 양쪽 다 적용

> 코드는 git을 타지만 **DB 구조 변경은 git을 안 탄다.** dev·운영 **둘 다** 직접 적용해야 한다(안 하면 어긋남).

1. 운영(project1): Claude **Supabase MCP `apply_migration`** 으로 적용 (접근 가능).
2. dev(dskphg…): **별도 계정이라 MCP 불가** → 대시보드 **SQL Editor**에 동일 DDL 붙여넣기.
3. 데이터(내용물)는 옮기지 않는다. 구조(양식)만 양쪽 일치시킨다.
4. 운영엔 테스트 데이터 INSERT 금지.

---

## 6. 로컬 테스트

### 6-1. 일반 기능 (확장 불필요)
에디터·뷰어·홈·플레이북·로그인 등 **대부분의 화면은 확장 없이** `npm run dev` + 브라우저(또는 Playwright)로 테스트. dev 계정(`test@naver.com`/`Devtest1234`)으로 로그인.

### 6-2. 녹화→캡처 흐름 (확장 필요)
Chrome 확장(`mimic_recorder`)은 **녹화 캡처 파이프라인에서만** 필요. **확장은 자기 ID로 dev/운영을 자동 판별**한다(웹스토어 배포본=운영, 개발자 언패킹=dev). 수동 전환 불필요.

**dev 테스트 셋업 (1회):**
1. `chrome://extensions` → 개발자 모드 ON → **압축해제된 확장 프로그램 로드** → `mimic_recorder` 폴더 선택. (dev 확장 ID = `dhfcmomnambegkibjnandckacihnaelb`)
   - 확장이 자동으로 **dev DB(dskphg…) + localhost:3000** 을 타깃 (서비스워커 콘솔에 `DEV 모드` 로그 확인).
2. **dev 서버를 반드시 포트 3000으로** 실행: `NODE_OPTIONS="--use-system-ca" npm run dev` (3000이 점유면 다른 인스턴스 종료 후 재실행 — 확장 연동이 localhost:3000에 고정).
3. localhost:3000 로그인(`test@naver.com`/`Devtest1234`) → 확장 팝업 **'연동하기'** → `localhost:3000/extension-link`에서 토큰 발급(웹앱이 `.env.development.local`의 `NEXT_PUBLIC_EXTENSION_ID`=dev 확장 ID로 전달).
4. 이제 녹화 → 캡처는 **dev DB + dev `naviaction` 버킷**에 기록된다(운영 무영향).

> 운영은 웹스토어 배포본(ID `ehbhcdkap…`)이 담당하며 Vercel Production env의 `NEXT_PUBLIC_EXTENSION_ID`=운영 ID를 사용. **개발자 언패킹 확장과 웹스토어 배포본은 ID가 달라 서로 섞이지 않는다.**

---

## 7. 절대 하지 말 것

| ❌ | ✅ |
|---|---|
| `main`에 직접 커밋 | `dev`에서 작업 후 총괄이 merge |
| 빌드 실패로 `main` push | `npm run build` 통과 후 배포 |
| 운영 DB에 테스트 데이터 INSERT | dev DB(dskphg…)에서만 테스트 |
| Vercel Production 환경변수 변경 | Preview 스코프만 dev로 |
| 스키마를 한쪽 DB만 변경 | dev·운영 **양쪽** 적용 |
| 같은 파일 동시 편집(멀티 인스턴스) | 영역 분할 + push 전 rebase |
| 확장으로 운영에 녹화 후 "테스트"라 착각 | 확장 dev 모드 후 테스트(§6-2) |
| **같은 `mimic_app` 폴더에서 `npm run dev` 여러 개** 띄우기 | 폴더당 1개만(병렬은 worktree=별도 `.next`). 여러 next dev가 같은 `.next` 공유 시 **`Cannot read properties of undefined (reading 'clientModules')`** 등 캐시 오염 발생 → 모든 dev 서버 종료 + `.next` 삭제 + 1개만 재기동으로 복구 |

---

## 8. 미해결 TODO
- 운영 admin 집계(`mm_view_events`)는 10만 상한 임시 처리 — 데이터 증가 시 SQL 집계 RPC로 전환.
- (참고) 확장 dev 모드는 완료됨(§6-2). Preview(원격) URL에서 확장 테스트하려면 manifest `externally_connectable`에 해당 vercel URL 추가 필요 — 현재는 localhost:3000만 지원.

---

## 9. 빠른 참조
| 목적 | 명령 |
|------|------|
| 로컬 dev 서버 | `NODE_OPTIONS="--use-system-ca" npm run dev` |
| 빌드 검증 | `NODE_OPTIONS="--use-system-ca" npm run build` |
| 현재 브랜치 | `git branch --show-current` |
| dev 최신화 | `git pull --rebase origin dev` |
| 운영 배포(총괄) | `git checkout main && git pull origin main && git merge dev && git push origin main && git checkout dev` |
| worktree 목록 | `git worktree list` |

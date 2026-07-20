# 가이드북 (Guidebook) — 현황 + 재작성 계획서

> 가칭 "Pages"를 **가이드북**으로 명명. 여러 워크플로우(가이드)+문서를 하나로 엮는 큐레이션 문서.
> URL/route는 기존 `/pages` 유지(리스크 최소화), **UI 라벨만 "가이드북"**으로 표기.
> 작성일 2026-06-17.
>
> **명칭 변경 기록(2026-07-21):** 이 문서는 구현 당시의 설계 이력으로 보존합니다. 현재 사용자-facing 명칭은 **플레이북**이며, 새 UI·도움말·문서에서는 가이드북이라는 이름을 사용하지 않습니다. `/pages`와 `guidebook` 코드 식별자는 호환성을 위해 유지될 수 있습니다.

---

## 0. 결론 요약

- 이미 **작동하는 Pages 기능이 존재**한다(이전 세션 산출물, migration 035). PRD의 절반 이상이 구현돼 있음.
- 결정: 직접 만든 버튼식 에디터를 버리고 **BlockNote로 전면 재작성**해 노션 수준의 블록 에디터로 끌어올린다.
- DB는 블록당 row(`mm_page_blocks`) → **`mm_pages.content` JSONB 단일 컬럼**으로 전환(BlockNote 문서 구조에 맞춤). 현재 0 rows라 마이그레이션 리스크 없음.

---

## 1. 기존 구현 현황 (재사용/교체 대상)

| 영역 | 파일 | 처리 |
|---|---|---|
| DB 스키마 | `supabase/migrations/035_create_pages.sql` | `mm_pages` 유지 + `content jsonb` 추가, `mm_page_blocks`는 폐기 |
| 타입 | `types/index.ts` (`Page`, `PageBlock`, `PageBlockType`, `PageDetail`) | `content` 기반으로 재정의 |
| API | `/api/pages`, `/api/pages/[id]`, `/api/pages/[id]/blocks`, 공개 `/api/p/[token]` | blocks 라우트 폐기, content를 `[id]` PATCH로 통합 |
| 에디터 | `app/pages/[id]/editor/page.tsx` | **BlockNote로 재작성** |
| 목록 | `app/pages/page.tsx` | 유지 + 가이드북 라벨 |
| 공개뷰 | `app/p/[token]/page.tsx` | BlockNote read-only 렌더로 재작성 |
| 홈 연동 | `app/home/page.tsx:572` (`/pages` 링크) | "새로 만들기 ▾" 드롭다운으로 승격 |

**기존 블록 타입:** heading / text(markdown) / video / **tutorial(가이드 임베드, 접기·펼치기)** — 핵심 임베드는 이미 작동.

---

## 2. PRD 대비 갭

| PRD | 현황 | 재작성 후 |
|---|---|---|
| 1. 워크플로우 임베드 | ✅ tutorial 블록 | BlockNote 커스텀 블록으로 이식 |
| 2. 노션식 편의(슬래시메뉴 등) | ❌ 버튼식 | ✅ BlockNote 기본 제공 |
| 3. 제목 헤더 | ✅ | 유지 |
| 4. 작성일·작성자 자동표시 | ❌ 데이터만 존재 | ✅ created_at + user 표시 |
| 5. 이미지/표/구분선/코드 블록 | ❌ | ✅ BlockNote 기본 + 커스텀 |
| 6. 홈 "새로 만들기" 분리 | ❌ | ✅ 드롭다운(새 매뉴얼/새 가이드북) |
| (추가) 댓글·멘션 | ❌ | 후순위 단계 |
| (추가) 권한 세분화 | 워크스페이스 단위만 | 후순위 단계 |
| (추가) 페이지 내 검색 | ❌ | 후순위 단계 |
| (추가) 실시간 협업 | ❌ | **최후순위** (Yjs, 별도 프로젝트급) |
| 제외 | 노션식 DB(필터·정렬), 페이지 중첩 | 범위 밖 |

---

## 3. 기술 결정

- **에디터:** BlockNote (`@blocknote/core`, `@blocknote/react`, `@blocknote/mantine`). 슬래시메뉴·드래그·이미지·표·코드·구분선·인용 기본 제공. 한글 IME 안정(ProseMirror 기반).
- **Next 연동:** 클라이언트 전용 → `'use client'` + `dynamic(import, { ssr:false })`로 래핑.
- **저장:** `mm_pages.content jsonb`에 BlockNote 문서(JSON 배열) 저장. 자동저장 디바운스 1s(기존 패턴 유지).
- **워크플로우 임베드:** `createReactBlockSpec` 커스텀 블록(`type: 'guide'`, props `{ tutorialId, defaultOpen }`). ~~iframe~~ → **서버 enrich 방식**: 공개 API가 content 내 guide 블록의 `tutorialId`로 스텝을 직접 조회(소유권 검사)해 어노테이션까지 인라인 렌더. iframe보다 우수하고 별도 공개 토큰 불필요.
- **의존성:** `@blocknote/*@0.51.4` + peer로 `@mantine/core@8.3.x` / `@mantine/hooks@8.3.x` 고정 필수. **Mantine 9.x는 React 19 API(`Activity`,`useEffectEvent`) 사용 → React 18 빌드 실패**.
- **임베드 게이팅:** 기존 `/api/guide/[token]` 한도 로직 그대로(페이지 레벨 추가 게이팅 없음).
- **DB 위치 주의:** 현재 dev/prod 분리 미완 — `mm_*`는 **prod(project1)에만** 존재. 스키마 DDL은 prod에 적용하되 **테스트 데이터 row 생성 금지**.

---

## 4. 구현 순서 (각 단계 검증)

```
1. 의존성: BlockNote 설치 → 검증: npm run build 통과
2. DB: mm_pages에 content jsonb 추가(migration 036) → 검증: 컬럼 존재 확인
3. 타입/API: PageDetail.content 기반 재정의, /api/pages/[id] PATCH로 content 저장,
   blocks 라우트 폐기 → 검증: 생성→content 저장→조회 라운드트립
4. 에디터 재작성: BlockNote 마운트 + 제목헤더 + 작성자/일자 + 자동저장
   → 검증: 새로고침 후 내용 유지, 한글 입력 스모크
5. 커스텀 가이드 임베드 블록 + 선택 모달 → 검증: 임베드한 매뉴얼 iframe 렌더
6. 공개뷰 /p/[token] BlockNote read-only 재작성 → 검증: 비로그인 published 접근
7. 홈 "새로 만들기 ▾" 드롭다운(새 매뉴얼/새 가이드북), 진입점 일관성
   (header·EmptyState·컨텍스트메뉴) → 검증: 두 타입 카드 동시 표시
─── 이후 후순위 단계 ───
8. 댓글·멘션  9. 권한 세분화  10. 페이지 내 검색  11. 실시간 협업(Yjs)
```

---

## 5. 리스크

- **기존 코드 폐기:** 작동하는 에디터/`mm_page_blocks`/blocks API를 버림. 0 rows라 데이터 손실은 없음.
- **한글 IME:** BlockNote 도입 직후 한글 조합 입력 반드시 검증.
- **번들 크기:** BlockNote+Mantine 추가 → 빌드 후 용량 확인.
- **prod 직접 작업:** dev DB 미분리 상태 — DDL만, 데이터 생성 금지.

# MIMIC 프로젝트 — 반복 실수 방지 가이드

이번 세션(마이페이지 구현)에서 실제로 발생한 문제들을 기록합니다.
배포·검증 전에 반드시 이 목록을 체크하세요.

---

## 1. `.next` 캐시 오염

**증상**: 로컬 빌드는 성공하는데 `SyntaxError: Unexpected end of JSON input` 또는 `Cannot read properties of undefined (reading 'call')` 빌드 에러 발생.

**원인**: `next start`(production)와 `next dev` 혼용, 또는 이전 빌드 아티팩트 충돌.

**해결**:
```bash
rm -rf .next
npx next build
```

**규칙**: 빌드 에러가 코드와 무관해 보이면 먼저 `.next` 삭제 후 재빌드.

---

## 2. Supabase `auth_provider` 미저장 (기존 Google 유저)

**증상**: Google 계정인데 프로필 카드에 편집 버튼이 노출됨.

**원인**: `app/api/auth/callback/route.ts`에서 신규 유저만 `auth_provider: 'google'`을 저장하고, 기존 유저(row 이미 있음)는 update를 건너뜀.

**해결**: callback에서 기존 유저도 `auth_provider`, `avatar_url` upsert.

**규칙**: Google OAuth callback에서 신규/기존 분기 시 기존 유저에도 최신 메타데이터를 반드시 업데이트.

---

## 3. `getCurrentUser()` 무한 대기 (무한 스피너)

**증상**: 마이페이지 cold navigate 시 스피너가 영원히 돌고 콘텐츠가 안 나옴.

**원인 A**: `supabase.auth.getUser()`는 네트워크 요청을 하기 때문에 hung 상태가 될 수 있음. `getSession()`으로 교체해야 함(로컬 캐시 읽기).

**원인 B**: `onAuthStateChange`에서 `INITIAL_SESSION` 이벤트를 처리하지 않으면 cold navigate에서 loading이 해제되지 않음.

**해결**:
- `getCurrentUser()`에서 `getUser()` → `getSession()` 교체
- `useAuth`에서 `INITIAL_SESSION` 이벤트로 즉시 loading 해제
- 4초 fallback timeout 추가 (어떤 상황에서도 무한 스피너 불가)

**규칙**: Supabase 클라이언트 사이드에서 초기 인증 확인은 `getSession()`만 사용. `getUser()`는 서버 검증이 필요한 민감한 경우에만.

---

## 4. `onAuthStateChange SIGNED_IN` 이벤트 무한 트리거

**증상**: 아바타 업로드 후 무한루프 / 상태가 계속 초기화됨.

**원인**: Supabase Storage API 호출이 내부적으로 토큰 갱신을 유발 → `TOKEN_REFRESHED` → `SIGNED_IN` 이벤트 재발화 → `getCurrentUser()` 재호출 → `setUser()` 반복.

**해결**:
- `INITIAL_SESSION`과 `SIGNED_IN`을 분리 처리
- `TOKEN_REFRESHED`, `USER_UPDATED` 이벤트는 `useAuth`에서 무시
- 업로드 성공 시 DB 재조회 대신 `updateUser(patch)` 로컬 업데이트

**규칙**: `onAuthStateChange`에서 처리할 이벤트를 명시적으로 allowlist로 관리. Storage/API 호출 후 auth state 변경으로 인한 재렌더 루프를 항상 의심.

---

## 5. Supabase `PostgrestBuilder` TypeScript 타입 에러

**증상**: `Promise.race([supabase.from(...).single(), timeout])` → `PromiseLike missing catch/finally` 에러.

**원인**: Supabase query builder가 표준 `Promise<T>`가 아닌 `PromiseLike`를 반환.

**해결**: `Promise.resolve(supabase.from(...).single())` 으로 래핑해 표준 Promise로 변환.

**규칙**: `Promise.race`에 Supabase query를 넣을 때 반드시 `Promise.resolve()`로 감쌀 것.

---

## 6. Playwright cold navigate 검증 실패 (세션 주입)

**증상**: localStorage에 Supabase 세션을 주입해도 미들웨어가 로그인 없음으로 판단해 리다이렉트.

**원인**: 미들웨어는 서버 사이드에서 쿠키 기반으로 세션 확인. localStorage 주입은 클라이언트에서만 작동.

**해결**: Playwright에서 실제 이메일/비밀번호 로그인 플로우를 UI에서 직접 실행.

**규칙**: MIMIC은 `@supabase/ssr` + PKCE flow 사용. 테스트 시 localStorage 주입 불가 — 반드시 UI 로그인.

---

## 7. Playwright `networkidle` 타임아웃으로 스피너 미감지

**증상**: `waitUntil: 'networkidle'`로 기다려도 스피너가 DOM에 남아있고 콘텐츠 미표시.

**원인**: Next.js RSC 스트리밍/재시도 요청으로 network가 idle 상태가 되어도 React 렌더링이 미완료.

**해결**:
```js
// ❌ 이렇게 하지 말 것
await page.goto(url, { waitUntil: 'networkidle' });

// ✅ 이렇게 할 것
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.querySelector('[style*="spin"]'), { timeout: 8000 });
// 콘텐츠가 나타날 때까지 추가 대기
await page.waitForFunction(() => document.body.innerText.includes('기대하는 텍스트'), { timeout: 5000 });
```

**규칙**: MIMIC 마이페이지/대시보드 검증 시 `networkidle` 대신 스피너 사라짐 + 콘텐츠 출현 조건으로 대기.

---

## 8. 마이페이지 cold navigate vs SPA navigate 동작 차이

**증상**: Playwright에서 `page.goto('/mypage')`로 직접 진입 시 RSC payload fetch 실패 에러 발생. SPA navigate(링크 클릭)는 정상.

**원인**: Next.js App Router에서 cold navigate 시 RSC prefetch가 실패하면 browser navigation으로 fallback — 동작은 정상이나 콘솔 에러 발생.

**해결**: 검증 시 대시보드에서 사이드바 링크를 클릭해 SPA navigate으로 진입하거나, cold navigate 후 `waitForURL` + 스피너 조건으로 대기.

**규칙**: 검증 스크립트에서 가능하면 SPA navigate 사용. cold navigate 필요 시 콘솔 에러는 무시(RSC fallback은 정상 동작).

---

## 9. 배포 전 미사용 변수 lint 에러

**증상**: `vercel --prod` 빌드 실패 — `'kakaoUrl' is assigned a value but never used`.

**원인**: 로컬 `next build`는 통과했으나 Vercel에서 strict lint로 실패. (로컬 빌드와 Vercel 빌드의 lint 설정 차이)

**해결**: 배포 전 `npx next build` 로컬 실행으로 사전 확인. 미사용 변수는 즉시 제거.

**규칙**: `vercel --prod` 전에 항상 로컬 `npx next build` 성공을 먼저 확인.

---

## 배포 체크리스트

배포 전 반드시 확인:
- [ ] `npx next build` 로컬 성공 확인
- [ ] `.next` 캐시 오염 의심 시 삭제 후 재빌드
- [ ] Supabase 관련 변경 시: `getSession()` vs `getUser()` 구분
- [ ] `onAuthStateChange` 변경 시: 처리 이벤트 목록 명시적으로 확인
- [ ] 새 기능 추가 시: 미사용 변수/import 없는지 확인

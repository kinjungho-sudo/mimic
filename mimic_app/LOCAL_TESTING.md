# 로컬 테스트 가이드 (에이전트용)

> **트리거**: 사용자가 "테스트해줘 / 검증해줘 / 확인해줘 / 동작 봐줘" 등 **앱 실제 동작 확인**을 요청하면,
> 이 문서 절차대로 **게스트 계정으로 localhost에 접속해 Playwright로 자동 검증**한다. (빌드·코드리뷰만으로 갈음하지 말 것)

---

## 0. 환경 사실 (중요)

- **localhost = 개발 DB(project2, `xsfriegbpygydcqhsqqq`)** 를 사용. (`.env.development.local` 이 `.env.local`(prod=project1)보다 우선)
- **prod = project1 (`gqynptpjomcqzxyykqic`)** — 로컬 테스트로 절대 건드리지 않음.
- 로컬 dev 서버는 **`NODE_OPTIONS=--use-system-ca` 필수** (SSL 인터셉트 환경). 없으면 Supabase 호출 전부 실패.
- 로그인은 **클라이언트(브라우저)→Supabase 직접** 호출. Google OAuth는 자동화 브라우저에서 막힐 수 있으니 **게스트(이메일/비번) 로그인** 사용.

## 1. 게스트 계정

- **이메일**: `devtest@mimic.dev`
- **비밀번호**: `Devtest1234!`
- 위치: 개발 DB(project2), `plan=pro`, 약관 동의 완료.
- **로그인 화면(`/auth/login`)에 개발 전용 버튼 `🧪 게스트로 테스트 입장`** 이 있음 → 원클릭 로그인. (prod 빌드엔 미노출)

## 2. 절차

1. **dev 서버 확인/기동** (백그라운드):
   ```bash
   cd mimic_app && NODE_OPTIONS="--use-system-ca" npm run dev
   ```
   - 이미 떠 있으면 재사용. 준비되면 `localhost:3000`.
2. **Playwright로 로그인**:
   - `localhost:3000/auth/login` 이동
   - `🧪 게스트로 테스트 입장` 버튼 클릭 (또는 이메일/비번 입력 후 로그인)
   - `/home` 진입 확인
   - ⚠️ Playwright 브라우저가 **사용자 실제 브라우저와 공유**될 수 있음 → 검증 중엔 그 창을 건드리지 말라고 안내.
3. **요청받은 동작 검증**:
   - 화면 캡처(`browser_take_screenshot`) + 필요 시 `browser_evaluate`로 실측(getBoundingClientRect 등)
   - 편집기/뷰어 비교 등은 새 탭 비교 + 종횡비/픽셀 측정으로 정량 확인
4. **결과 보고**: 통과/실패 + 근거(스크린샷·측정값). 실패 시 원인·수정.

## 3. 검증용 시드 데이터

- 매뉴얼 **"캔버스 검증용 매뉴얼"** (project2): 3스텝 = 긴 세로(넘침/맞춤) / 가로 / 줌 231% + 어노테이션. 캔버스·렌더 테스트에 사용.
- 더 필요하면 project2에 SQL로 시드(`mm_tutorials`/`mm_steps`). prod(project1)엔 시드 금지.

## 4. 알려진 함정

- **project2 mm 스키마 부분 동기화**: `mm_steps`/`mm_tutorials`만 prod 기준으로 맞춤. 다른 `mm_*`(workspaces/branding/comments/folders/pages 등)는 컬럼이 구버전일 수 있음 → 해당 기능 테스트 중 컬럼 오류 나면 prod(project1) 컬럼에 맞춰 `ADD COLUMN`.
- 캔버스 maxHeight는 `calc(100vh - 320px)` → 뷰포트 높이에 따라 절대 크기가 달라짐(정상). WYSIWYG 판정은 **종횡비/프레이밍 일치**로 한다.
- 외부 이미지(picsum 등)는 브라우저에서 로드됨(외부 HTTPS 가능 확인됨).

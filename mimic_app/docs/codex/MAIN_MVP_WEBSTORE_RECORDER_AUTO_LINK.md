# Main MVP — Chrome Web Store Recorder 자동 연동

작성일: 2026-07-23

## 목표

Main 웹앱은 Chrome Web Store의 공개 Parro Recorder 항목을 버전 번호와 무관하게 항상 사용한다.

- 공개 확장 ID: `lefkpmfgdbhckcemfghpegleknaepekm`
- 공개 Web Store 항목에서 `1.7.2`, `1.7.3`, `1.8.0` 등으로 업데이트해도 웹앱 수정 없이 계속 연결
- 개발 환경과 Preview에서는 개발자 언패킹 확장 ID를 동적으로 선택 가능
- 기존 MIMIC 확장 ID는 기존 설치 호환용으로만 보존

## 구현

### Production ID 선택

- Production에서는 `NEXT_PUBLIC_EXTENSION_ID`, URL의 `extension_id`, localStorage 값보다 공개 Parro Web Store ID를 우선한다.
- 오래된 Vercel 환경변수에 기존 MIMIC ID가 남아 있어도 main 웹앱은 공개 Parro Recorder에 연결한다.
- 공개 설치 링크도 같은 Web Store ID를 사용한다.

### Dev / Preview ID 선택

- `localhost`, `127.0.0.1`, Parro Preview, Vercel Preview에서만 동적 ID 선택을 허용한다.
- 선택 순서는 URL query, localStorage, 개발 환경변수다.
- ID가 준비되지 않았으면 Recorder content script의 ID broadcast를 기다린다.

### Recorder 소스와 버전

- Recorder 소스는 main의 최신 안정화 상태를 유지한다.
- 웹앱은 Recorder manifest 버전을 비교하거나 특정 버전으로 고정하지 않는다.
- Web Store에서 같은 항목을 새 버전으로 업데이트하면 Chrome이 같은 확장 ID로 자동 업데이트하므로 main 연결은 유지된다.
- Recorder runtime은 공개 Parro ID를 운영 확장으로 인식해야 한다.
- Recorder manifest의 `externally_connectable`에는 main Production origin이 유지되어야 한다.

## 자동 회귀 검증

`verify:webstore-recorder-link`가 다음을 검사한다.

- Production host는 오래된 env/query/storage 값이 있어도 공개 Parro ID 선택
- Dev/Preview host는 개발 확장 ID 선택 가능
- BOM이 포함된 ID 정리
- Recorder background와 popup이 공개 Parro ID를 운영 ID로 인식
- Recorder manifest가 Production origin과 호환 origin을 허용
- 검증 계약에 Recorder 버전 번호가 포함되지 않음

이 검증은 `npm test`의 품질 계약에 포함되어 향후 main 변경에서 자동 실행된다.

## Desktop 비공개

- 홈, 녹화 모달, 설정, 도움말, 확장 연결, FAQ, 요금제의 Desktop 설치·캡처 진입점은 제거된 상태를 유지한다.
- `/download/desktop`, `/downloads/ParroDesktopSetup.exe`, `/desktop-setup`, `/desktop-import` 직접 접근은 `/landingpage`로 이동한다.
- Desktop 내부 코드, installer, native host, bridge/import 코드와 개발 문서는 보존한다.

## 검증 결과

- `npm.cmd run verify:webstore-recorder-link`: 통과, 11개 검사
- `npm.cmd run verify:main-mvp-release`: 통과, 24개 검사
- `npm.cmd run lint`: 통과
- `npx.cmd tsc --noEmit`: 통과
- `npm.cmd test`: 통과
- `npm.cmd run verify:live-guide`: 통과, 26개 검사
- `npm.cmd run verify:recorder-profile`: 통과, 14개 검사
- Recorder source contract: 통과
  - capture flow 16개
  - capture readiness 12개
  - live guide 52개
  - targeting 11개
  - desktop import 15개
- `npm.cmd run build`: 통과, production build 완료

## 운영 조건

- Recorder를 반드시 동일한 Web Store 항목 `lefkpmfgdbhckcemfghpegleknaepekm`의 새 버전으로 배포해야 한다.
- Web Store 항목 자체를 새로 만들면 확장 ID가 바뀌므로 main의 공개 ID도 변경해야 한다.
- 새 Recorder 버전에서 `externally_connectable`의 Production origin이나 운영 ID 판별을 제거하면 자동 연동이 깨지며 회귀 검증이 이를 차단한다.

# Main MVP 후보 — Web Store Recorder 1.7.2 / Desktop 비공개

작성일: 2026-07-23

## 완료 요약

- Chrome Web Store의 새 Parro 항목 `lefkpmfgdbhckcemfghpegleknaepekm`에서 공개 중인 버전 `1.7.2`를 릴리스 기준으로 확정했다.
- 공개 CRX와 기존 제출 ZIP을 대조해 Web Store가 주입한 `update_url` 외 15개 파일이 동일함을 확인했다.
- 후보 브랜치의 Recorder 런타임 16개 파일과 패키징 목록을 승인된 1.7.2 기준으로 맞췄다.
- 공개 설치 링크를 새 Parro 항목으로 전환하고, 기존 MIMIC 확장 ID는 설치 호환 목록에만 보존했다.
- 홈, 녹화 모달, 설정, 도움말, 확장 연결, FAQ, 요금제에서 Desktop 설치·캡처 진입점을 제거했다.
- 직접 URL 접근은 middleware에서 `/landingpage`로 돌리며, Desktop 내부 코드·설치 파일·문서는 삭제하지 않았다.

## 브랜치 / 배포 상태

- 시작 브랜치: `dev`
- 기준 브랜치: `origin/main`
- 작업 브랜치: `release/mvp-webstore-recorder-v172-hide-desktop`
- main 직접 커밋/병합/push: 하지 않음
- Production 배포 및 Vercel alias 변경: 하지 않음
- Chrome Web Store 업로드 및 승인 버전 `1.7.2`의 추가 변경: 하지 않음

## Recorder 1.7.2 확인

- 공개 확장 ID: `lefkpmfgdbhckcemfghpegleknaepekm`
- 공개 이름: `Parro Recorder`
- 공개 버전: `1.7.2`
- 로컬 manifest 경로: `mimic_recorder/manifest.json`
- 제출 ZIP SHA-256: `766b62864c330fbfdfd9d761e61cf1280b56d1a6c58f488694985e6e65e47ec4`
- 공개 CRX와 제출 ZIP 비교:
  - 파일 수: 각각 16개
  - 제출 파일 15개: 내용 해시 동일
  - `manifest.json`: Web Store가 `update_url`만 추가
- `background.js`와 `popup.js`는 새 Parro ID와 기존 MIMIC ID를 모두 운영 확장 ID로 인식한다.
- 패키징 스크립트는 승인본과 동일하게 13개 런타임 파일과 아이콘 3개만 포함한다.
- `verify:main-mvp-release`가 16개 파일의 정규화 SHA-256과 manifest `1.7.2`, 공개 확장 ID를 고정 검증한다.

## Desktop 공개 노출 숨김

- 제거한 공개 진입점:
  - 홈 사이드바·헤더·모바일 메뉴의 Desktop 설치 링크
  - 새 매뉴얼 메뉴와 녹화 모달의 데스크톱 녹화 선택
  - 설정의 Desktop Companion 영역
  - 도움말의 Desktop Companion 섹션
  - 확장 연결 완료 화면의 Desktop 설치 안내
  - 챗봇 FAQ, 빠른 질문, Pro 요금제의 Desktop 문구
- 직접 접근 차단:
  - `/download/desktop`
  - `/downloads/ParroDesktopSetup.exe`
  - `/desktop-setup`
  - `/desktop-import`
- 보존한 내부 자산:
  - Desktop route 소스
  - 설치 파일과 native host
  - Desktop bridge/import 코드
  - 내부 개발 문서와 호환 식별자

## 검증 결과

- `npm.cmd run verify:main-mvp-release`: 통과, 36개 계약 검사 및 Recorder 패키지 파일 16개 일치
- `npm.cmd run lint`: 통과, warning/error 없음
- `npx.cmd tsc --noEmit`: 통과
- `npm.cmd test`: 통과, 품질 계약 전체 통과
- `npm.cmd run build`: 통과, production build 및 76개 static page 생성 완료
- Recorder 런타임 JS 9개 `node --check`: 통과
- `verify-desktop-import.js`: 통과, 15개 검사
- `npm.cmd run verify:live-guide`: 실패
  - 승인본 1.7.2에서 fail-closed 테스트가 가이드 오버레이 자동 제거를 기다리다 timeout
- `npm.cmd run verify:recorder-profile`: 실패
  - 격리된 로컬 프로필에서 live guide 시작 후 새 가이드 페이지가 열리기를 기다리다 timeout
- 최신 Recorder 계약 테스트:
  - `verify-capture-flow-contract.js`: 실패 — 1.7.2에는 후속 브라우저/데스크톱 캡처 분리 패치가 없음
  - `verify-capture-readiness.js`: 실패 — 1.7.2에는 후속 readiness UI가 없음
  - `verify-live-guide-contract.js`: 실패 — 테스트가 현재 main의 1.7.8 계약을 요구
  - `verify-targeting.js`: 실패 — 1.7.2에는 후속 targeting API가 없음

## OWNER_APPROVAL_REQUIRED

### 항목: Recorder 1.7.3~1.7.8 후속 안정화 패치

- 왜 1.7.2 호환성 위험인지:
  - 승인본 1.7.2를 정확히 유지하면 현재 main의 live guide fail-closed, capture readiness, browser/desktop capture isolation, targeting 안정화 계약을 만족하지 못한다.
  - 해당 패치를 Recorder에 넣으면 승인본 1.7.2와 달라지고 manifest 버전 변경 및 Web Store 재심사가 필요하다.
- 가능한 선택지:
  1. 공개 1.7.2를 그대로 main 기준으로 사용하고 위 회귀 위험을 수용한다.
  2. 필요한 후속 패치를 선별해 새 Recorder 버전으로 Web Store 심사를 먼저 진행한다.
  3. 실제 Web Store 1.7.2 설치본으로 MVP 핵심 흐름을 별도 수동 검증한 뒤, 허용 가능한 위험만 문서화한다.
- 추천:
  - main 병합 전에 선택지 3을 수행하고, 핵심 흐름 실패가 재현되면 선택지 2로 전환한다.
- 승인 없이는 하지 않을 작업:
  - Recorder 1.7.2 수정
  - manifest 버전 변경
  - Web Store 신규 업로드
  - 후속 Recorder 패치의 임의 혼합

### 항목: main 병합 / Production 배포

- main은 Production 자동 배포 가능성이 있으므로 별도 최종 승인이 필요하다.
- 승인 전에는 main push, Production deploy, Vercel production alias 변경을 하지 않는다.

## MAIN_MERGE_CANDIDATE 판단

- 조건부 후보 상태다.
- 웹앱 build, lint, type check, 품질 테스트, Desktop 비공개 계약, Recorder 1.7.2 패키지 계약은 통과했다.
- 남은 blocker는 공개 Web Store 1.7.2 설치본으로 MVP 핵심 녹화·완료·라이브 가이드 흐름을 확인하고, 후속 안정화 패치 제외 위험을 제품 소유자가 수용할지 결정하는 것이다.
- rollback은 이 후보 커밋을 main에 반영하지 않거나, 반영 후 단일 후보 커밋을 revert하는 방식으로 제한할 수 있다.

## 절대 하지 않은 것

- Recorder 1.7.2 승인 패키지 내용 수정
- Chrome Web Store 업로드
- Desktop 공개
- main 직접 커밋 또는 push
- Production 배포
- DB/auth/storage/billing 변경
- 운영 migration 또는 실제 고객 데이터 변경

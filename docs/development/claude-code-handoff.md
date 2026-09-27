# Parro Claude Code 인수인계

기준: 2026-09-27 로컬 점검. 이 문서는 시작점이며 브랜치와 배포 상태는 작업마다 다시 확인한다.

## 작업 위치와 범위

- 공식 로컬 체크아웃: `D:\project\dev\parro`; Git 원격: `https://github.com/kinjungho-sudo/mimic.git`.
- 점검 당시 `dev`는 `origin/dev`와 일치하고 작업 트리는 깨끗했다. HEAD: `006d38b7` (`build(recorder): isolate desktop store runtime`).
- `D:\project\dev\mimic`과 주변 `mimic-*` 디렉터리는 과거 작업용 체크아웃이다. Parro 개발 Recorder를 이 경로에서 빌드하거나 로드하지 않는다.
- `D:\project\dev\parro-edu`는 독립 저장소이며 이번 이관 대상이 아니다.

## 구성과 명령

| 위치 | 역할 | 확인 명령 |
| --- | --- | --- |
| 루트 `scripts/verify-parro-workspace.ps1` | Recorder 작업 전 저장소 위치·브랜치·버전 확인 | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-parro-workspace.ps1` |
| `mimic_app` | Next.js 웹 서비스와 API | `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` |
| `mimic_recorder` | Chrome Recorder와 Live Guide | 웹 앱의 `npm.cmd run verify:recorder-profile`, `npm.cmd run verify:live-guide`, `npm.cmd run verify:recorder-store-package` |
| `mimic_desktop` | Desktop companion·Native Host | 웹 앱의 `npm.cmd run verify:desktop` |

`mimic_app/package.json`이 검증 명령의 기준이다. `npm.cmd run build`는 Desktop 설치 파일 확인을 선행하므로, 파일이 없는 환경의 실패를 웹 코드 실패로 해석하지 않는다. `.env.local`, `.vercel` 등 로컬 설정은 Git에 올리거나 인수인계 문서로 복사하지 않는다.

## 개발·배포 경계

`mimic_app/docs/DEV_PROCESS.md`에 기능 브랜치, 검증, Preview, Production 순서가 기록되어 있다. 이 저장소에서는 `dev` push가 Preview를, `main` push가 Production을 자동 실행할 수 있다. 배포 의뢰를 받으면 후보 브랜치와 배포 대상, 현재 Vercel 프로젝트 링크, 실제 alias를 확인한다. Ready 상태와 로컬 빌드는 사용자가 접속하는 alias의 정상 동작을 증명하지 않는다.

Recorder 변경은 먼저 루트의 workspace 검증 스크립트를 통과해야 한다. 개발 확장은 `D:\project\dev\parro\mimic_recorder`에서 로드한다. Chrome이 예전 unpacked 경로를 가리킬 경우 `scripts/deploy-parro-recorder-dev.ps1`의 스냅샷·해시 검증 절차를 따른다. 실제 확장 ID, 설치 버전, 웹 origin 및 브라우저 동작을 확인해야 릴리스 검증이라 할 수 있다.

## 이어받을 때 확인할 것

- 과거 Codex 기록에는 Desktop 캡처에서 브라우저 편집기로 넘기는 흐름의 로컬 검증이 있지만, 당시 Production 배포와 설치된 Recorder의 전체 흐름 검증은 완료되지 않았다. 현재 브랜치의 구현·배포 여부를 새로 확인한다.
- Live Guide는 소스 검사와 설치된 확장 동작을 구별한다. 대상 탭, 오버레이, 강조 표시, 콘솔 오류를 같은 환경에서 확인한다.
- EDU는 별도 저장소·배포·데이터베이스 경계를 가진다. 이 문서의 웹/Recorder 결과를 EDU의 호스팅 데이터 영속성 증거로 사용하지 않는다.
- 사용자에게 공개되는 문구는 Parro를 사용한다. `MIMIC`은 안정성이 필요한 내부 식별자에만 남긴다.

## Claude Code 첫 실행

PowerShell에서 `cd D:\project\dev\parro` 후 `claude`를 실행한다. `/context` 또는 `/memory`에서 이 저장소의 `CLAUDE.md`와 `AGENTS.md` 반영 여부를 확인한다. `claude doctor`는 설치·설정 진단에 사용한다. 2026-09-27 WinGet 설치 버전은 2.1.268이며 설치 진단은 통과했다. 현재 Codex 셸은 이전 PATH를 유지하므로 새 터미널에서 실행해야 한다. 계정 로그인이 없어 실제 모델 응답 검증은 아직 하지 않았다.

## 2026-09-28 로컬 후속 작업

`feat/parro-admin-activity-logs` 브랜치에서 관리자 사용자 활동 로그를 구현 중이다. 웹 생성·Recorder 완료·인증된 화면 접속·매뉴얼 열람을 `mm_logs` 감사 카테고리에 기록하고, `/admin/logs`에서 사용자 이메일과 매뉴얼 제목을 함께 표시한다. 실제 호스팅 DB에는 아직 배포되지 않았으므로 Preview/Production 동작을 확인해야 한다.
현재 `mimic_app/.env.local`에는 Supabase 접속 변수가 없어 로컬에서 `mm_logs` 실데이터 조회를 수행할 수 없었다. 빌드·lint 결과와 호스팅 기능 검증을 구별한다.

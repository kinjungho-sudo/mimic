# MIMIC Desktop App PRD v0.1

## 1. 한 줄 정의

MIMIC Desktop App은 웹과 Windows 로컬 작업 사이에서 끊기는 업무 흐름을 자동으로 이어붙여, 문서와 Live Guide로 바로 재사용하게 만드는 Desktop Companion이다.

## 2. 배경

고객 인터뷰에서 확인된 핵심 문제는 사용자의 실제 업무가 브라우저 안에서만 끝나지 않는다는 점이다. 많은 업무는 웹에서 시작하지만 중간에 다운로드, 파일 열기, 로컬 앱 수정, 저장, 업로드, 설치, 로그인, 권한 승인 같은 Windows Desktop 작업을 포함한다.

기존 Web Recorder만으로는 이 구간이 비어버린다. 결과적으로 생성된 매뉴얼은 실제 업무 흐름을 완전히 설명하지 못하고, Live Guide도 사용자가 브라우저 밖에서 무엇을 해야 하는지 안내하지 못한다.

MIMIC Desktop App의 1차 목적은 Desktop 전체 자동화가 아니라, 웹과 Desktop 사이의 빈 구간을 업무 단계로 복원하는 것이다.

## 3. 제품 전략

MIMIC은 순수 문서화 도구나 RPA 도구가 아니라, 실제 사람이 수행하는 업무 흐름을 캡처하고 재사용 가능한 가이드로 전환하는 제품이다.

Desktop App은 독립 제품이 아니라 MIMIC의 기존 흐름을 확장하는 Companion 역할을 맡는다.

- Web App: 매뉴얼 생성, 편집, 공유, 팀 관리, Live Guide 실행
- Chrome Recorder: 웹 클릭, 입력, 페이지 이동, 다운로드, 업로드 이벤트 캡처
- Desktop App: 브라우저 밖 파일, 앱, 저장, 복귀 이벤트 캡처

핵심 차별점은 `웹 이벤트 + Desktop 파일 이벤트 + 업로드 복귀`를 하나의 업무 흐름으로 병합하는 것이다.

Desktop App은 캡처 도중 필요할 때 설치를 유도하는 방식이 아니라, 초기 온보딩에서 간단히 설치하고 연결을 끝내는 방식을 기본값으로 삼는다. 사용자는 캡처 중에 Desktop 구간이 필요한지 판단하기 어렵고, 업무 기록 중 설치 흐름으로 빠지는 것은 경험을 깨뜨릴 수 있다.

## 4. 목표

- 웹과 Desktop 사이에서 누락되는 업무 단계를 매뉴얼에 자동 삽입한다.
- 다운로드한 파일이 로컬에서 열리고 수정된 뒤 다시 웹에 업로드되는 흐름을 하나의 세션으로 연결한다.
- Live Guide가 Desktop 작업 구간에서 사용자를 안내하고, 완료 여부를 감지해 다음 웹 단계로 이어준다.
- 사용자가 감시당한다고 느끼지 않도록 수집 범위와 권한을 명확히 제한한다.

## 5. 비목표

MVP에서 다음은 하지 않는다.

- Excel, PDF, 설치 프로그램 내부를 자동 조작하지 않는다.
- 비밀번호, 인증 코드, 보안 프로그램 화면을 자동 입력하지 않는다.
- OS 전체 화면을 지속 녹화하지 않는다.
- 모든 Desktop UI 이벤트를 RPA 수준으로 재현하지 않는다.
- 파일 내용 전체를 기본 업로드하지 않는다.
- 무인 자동 실행을 핵심 가치로 약속하지 않는다.

## 6. MVP 범위

MVP는 `파일 중심 워크플로우 연결`에 집중한다.

대표 시나리오:

1. 사용자가 초기 온보딩에서 Desktop App을 설치하고 Chrome Extension과 연결한다.
2. 사용자가 Chrome Recorder에서 기록을 시작한다.
3. 웹에서 파일을 다운로드한다.
4. Desktop App이 다운로드된 파일과 저장 위치를 감지한다.
5. 사용자가 해당 파일을 Excel, PDF 뷰어, 압축 프로그램, 설치 프로그램 등에서 연다.
6. Desktop App이 파일 열림, 수정, 저장, 새 파일 생성을 감지한다.
7. 사용자가 브라우저로 돌아온다.
8. 웹에서 파일 업로드 이벤트가 발생한다.
9. 서버가 웹 이벤트와 Desktop 이벤트를 병합한다.
10. 생성된 매뉴얼에 `PC 작업` 단계가 삽입된다.
11. Live Guide는 사용자가 로컬 작업을 완료하고 웹으로 복귀하도록 안내한다.

## 7. 설치 및 온보딩 원칙

Desktop App은 설치형 제품이지만, 설치 자체가 진입장벽이 되면 안 된다. 사용자가 Desktop 기능의 필요성을 매번 판단하게 만들지 않고, 초기 설정에서 한 번에 끝내는 것이 원칙이다.

### 7.1 기본 방향

- Desktop App 설치는 첫 캡처 전 온보딩 단계에서 완료한다.
- 설치 흐름은 3분 이내에 끝나는 것을 목표로 한다.
- 설치 후 Chrome Extension과 Desktop App 연결 확인까지 자동으로 이어져야 한다.
- 캡처 중에 추가 설치를 요구하지 않는다.
- 기록 시작 시 Desktop App 연결 상태를 간단히 확인한다.
- 연결이 끊긴 경우에는 캡처 시작 전에 복구하도록 안내한다.

### 7.2 설치 흐름

권장 흐름:

1. 사용자가 MIMIC 가입 또는 첫 워크스페이스 진입을 완료한다.
2. Chrome Extension 설치를 안내한다.
3. Desktop App 설치 파일을 다운로드한다.
4. 사용자가 `.msi` 또는 `.exe` 설치를 완료한다.
5. 설치 과정에서 Native Messaging host가 등록된다.
6. Web App이 Extension과 Desktop App 연결 상태를 확인한다.
7. 연결이 확인되면 첫 캡처를 시작할 수 있다.

### 7.3 사용자 메시지

설치 화면의 메시지는 기능 나열보다 신뢰와 이유를 먼저 설명해야 한다.

예시:

```text
MIMIC은 웹에서 시작해 PC 파일 작업으로 이어지는 업무까지 하나의 흐름으로 기록합니다.
Desktop App을 설치하면 다운로드, 파일 수정, 저장, 업로드 복귀 단계가 매뉴얼과 Live Guide에 자동으로 연결됩니다.

파일 내용은 기본으로 업로드하지 않으며, 기록 중인 세션에서만 파일 작업 흐름을 감지합니다.
```

### 7.4 실패 및 예외 처리

- Desktop App이 설치되지 않았으면 Desktop 연결 기능이 비활성 상태로 표시된다.
- 연결 실패 시 캡처 중간이 아니라 캡처 시작 전에 해결하도록 안내한다.
- 설치가 불가능한 환경에서는 수동 Desktop 단계 추가만 제공한다.
- 조직 보안 정책으로 설치가 막히는 경우 관리자 설치 가이드와 배포 파일을 제공한다.

## 8. 자동 감지와 사용자 입력의 경계

### 8.1 자동 감지 대상

Desktop App은 사실 이벤트를 자동 감지한다.

- 다운로드 파일 생성
- 파일 열림
- 파일 수정
- 파일 저장
- 새 파일 생성
- 활성 앱 전환
- 브라우저 복귀
- 업로드 후보 파일 식별

수집 예시:

- 파일명
- 확장자
- 마스킹된 경로
- 파일 크기
- 수정 시각
- 앱 이름
- 선택적 파일 fingerprint
- capture_session_id
- timestamp

### 8.2 사용자 입력 대상

업무 의미와 판단은 사용자 입력 또는 AI 보정으로 남긴다.

- 이 파일에서 무엇을 확인했는지
- 어떤 값을 수정했는지
- 왜 이 파일을 업로드해야 하는지
- 설치/로그인/승인 단계의 업무적 의미
- 예외 상황에서 어떤 기준으로 판단했는지
- 민감한 작업에 대한 설명

원칙:

> Desktop App은 무슨 일이 일어났는지를 자동으로 잡고, 사용자는 그 일이 업무적으로 무슨 의미인지 보충한다.

## 9. 시스템 구조

```text
Chrome Recorder
  - 웹 클릭/입력/다운로드/업로드 이벤트 캡처
  - capture_session_id 생성 및 공유

Desktop App
  - 다운로드 폴더 감시
  - 파일 열림/수정/생성 감지
  - 활성 앱 전환 감지
  - 같은 capture_session_id로 desktop_event 전송

MIMIC Server
  - web_event + desktop_event 수집
  - timestamp, filename, file fingerprint로 이벤트 병합
  - manual step / live guide step 생성

Web App
  - 생성된 Desktop 단계 표시
  - Live Guide에서 로컬 작업 안내
```

## 10. 세션 연결 방식

기록 시작 시 Web Recorder가 서버에서 `capture_session_id`를 발급받는다. Chrome Extension은 이 값을 Desktop App에 전달하고, Desktop App은 같은 세션 ID로 로컬 이벤트를 전송한다.

우선순위:

1. Chrome Native Messaging
2. localhost WebSocket 또는 HTTP bridge

세션 시작 메시지 예시:

```json
{
  "type": "START_CAPTURE_SESSION",
  "capture_session_id": "cap_123",
  "workspace_id": "ws_456",
  "user_id": "user_789"
}
```

세션 종료 메시지 예시:

```json
{
  "type": "STOP_CAPTURE_SESSION",
  "capture_session_id": "cap_123"
}
```

## 11. 이벤트 모델 초안

### 11.1 Browser 이벤트

```json
{
  "type": "browser_download_started",
  "capture_session_id": "cap_123",
  "url": "https://example.com/report.xlsx",
  "filename": "report.xlsx",
  "timestamp": "2026-07-07T10:00:00Z"
}
```

```json
{
  "type": "browser_upload_selected",
  "capture_session_id": "cap_123",
  "filename": "report_final.xlsx",
  "input_selector": "input[type=file]",
  "timestamp": "2026-07-07T10:05:00Z"
}
```

### 11.2 Desktop 이벤트

```json
{
  "type": "desktop_file_created",
  "capture_session_id": "cap_123",
  "file_name": "report.xlsx",
  "file_path_masked": "C:\\Users\\...\\Downloads\\report.xlsx",
  "extension": ".xlsx",
  "timestamp": "2026-07-07T10:00:04Z"
}
```

```json
{
  "type": "desktop_file_modified",
  "capture_session_id": "cap_123",
  "file_name": "report.xlsx",
  "file_path_masked": "C:\\Users\\...\\Downloads\\report.xlsx",
  "extension": ".xlsx",
  "app_name": "Excel",
  "timestamp": "2026-07-07T10:03:20Z"
}
```

```json
{
  "type": "desktop_app_activated",
  "capture_session_id": "cap_123",
  "app_name": "Excel",
  "window_title_masked": "report.xlsx - Excel",
  "timestamp": "2026-07-07T10:01:12Z"
}
```

## 12. 이벤트 병합 로직

서버는 `capture_session_id`를 1차 기준으로 삼고, 파일 흐름을 보조 기준으로 병합한다.

병합 기준:

- 같은 `capture_session_id`
- 다운로드 이후 일정 시간 안에 생성/수정된 파일
- 파일명 유사도
- 확장자 일치
- 파일 크기
- 수정 시각
- 선택적 file fingerprint
- 업로드 이벤트와 가까운 파일 변경 이벤트

병합 결과 예시:

```json
{
  "step_type": "desktop_file_task",
  "title": "다운로드한 파일을 Excel에서 수정합니다",
  "body": "report.xlsx 파일을 Excel에서 열고 필요한 내용을 확인한 뒤 저장합니다.",
  "source_events": [
    "browser_download_started",
    "desktop_file_created",
    "desktop_app_activated",
    "desktop_file_modified"
  ],
  "next_step_hint": "저장한 파일을 웹 화면에 업로드합니다."
}
```

## 13. 매뉴얼 UI

Desktop 단계는 웹 단계와 구분되는 정식 단계 타입으로 표시한다.

단계 타입:

- `PC 작업`
- `파일 작업`
- `로컬 앱`
- `설치`
- `업로드 준비`

표시 예시:

```text
PC 작업
report.xlsx 파일을 Excel에서 열고 필요한 내용을 확인한 뒤 저장합니다.

앱: Excel
파일: report.xlsx
위치: Downloads
다음 단계: 저장한 파일을 웹 화면에 업로드
```

UI 원칙:

- Desktop 단계는 임시 메모가 아니라 정식 workflow step으로 보여준다.
- 파일 경로는 기본 마스킹한다.
- 파일 내용은 기본 표시하지 않는다.
- 사용자가 단계 설명을 직접 수정할 수 있어야 한다.
- AI가 생성한 설명은 사용자가 확인할 수 있어야 한다.

## 14. Live Guide 동작 범위

MVP에서 Live Guide는 로컬 작업을 대신 수행하지 않고, 사용자가 올바른 작업을 끝낸 뒤 웹 흐름으로 돌아오도록 안내한다.

가능한 기능:

- 다운로드된 파일 열기 버튼
- 다운로드 폴더 열기 버튼
- 파일이 열렸는지 감지
- 파일 수정/저장 완료 감지
- 브라우저 복귀 안내
- 업로드 후보 파일 제안
- 업로드 완료 후 다음 단계 진행

하지 않는 기능:

- Excel 내부 셀 조작
- PDF 내부 내용 자동 판독
- 설치 마법사 자동 클릭
- 비밀번호/OTP 자동 입력
- OS 전체 화면 녹화
- 사용자 동의 없는 파일 내용 업로드

Live Guide 원칙:

> MIMIC은 사용자를 대신해 PC를 조작하기보다, 사용자가 올바른 로컬 작업을 끝내고 웹 흐름으로 돌아오도록 안내한다.

## 15. 보안 및 신뢰 원칙

Desktop App은 감시 도구처럼 보이면 안 된다. 사용자가 언제 무엇이 기록되는지 명확히 알아야 한다.

원칙:

- 기록 시작/중지 상태를 항상 명확히 표시한다.
- 현재 감지 중인 세션과 앱/파일 범위를 보여준다.
- 파일 경로는 기본 마스킹한다.
- 파일 내용 수집은 기본 OFF로 둔다.
- 민감 앱/폴더 제외 목록을 제공한다.
- 비밀번호, OTP, 결제, 개인 인증 화면은 자동 기록 대상에서 제외한다.
- 조직 관리자보다 최종 사용자의 신뢰를 우선한다.

## 16. 기술 선택 초안

추천:

- Desktop App: Tauri
- Windows 감지: Rust file watcher + Windows API
- Chrome 연결: Native Messaging
- 서버 통신: 기존 MIMIC API
- 저장: `desktop_events` 테이블 추가
- 생성: 기존 `capture/finalize` 파이프라인 확장

Tauri를 우선 추천하는 이유:

- Electron보다 가볍다.
- Companion 앱 성격에 적합하다.
- Windows 파일 감지 및 Native API 연동이 가능하다.
- 설치형 앱에 필요한 신뢰감을 만들기 쉽다.

검토 필요:

- Windows 코드 서명
- 자동 업데이트
- 백신 오탐 방지
- Native Messaging host 등록
- 설치/삭제 UX

## 17. 데이터 모델 초안

### 17.1 desktop_events

```text
id
workspace_id
user_id
capture_session_id
event_type
event_payload
occurred_at
created_at
```

### 17.2 file_artifacts

```text
id
workspace_id
capture_session_id
file_name
extension
path_masked
size_bytes
fingerprint
first_seen_at
last_modified_at
created_at
```

### 17.3 manual_steps 확장

```text
step_type: desktop_file_task | desktop_app_task | web_action | guide_instruction
desktop_event_ids
file_artifact_ids
app_name
file_name
path_masked
next_step_hint
```

## 18. 경쟁사 기준 포지셔닝

MIMIC은 다음 사이의 빈 공간을 노린다.

- Scribe, Tango, Guidde: 쉬운 문서화와 가이드 생성
- WalkMe, Whatfix: 업무 중 실시간 안내
- UiPath, Power Automate: Desktop 자동화와 프로세스 캡처

MIMIC의 차별점:

> Scribe처럼 쉽게 기록하고, Tango처럼 필요한 순간 안내하되, 웹과 Windows 로컬 작업 사이의 파일 흐름까지 끊기지 않게 이어주는 워크플로우 가이드.

MVP에서는 RPA처럼 무겁게 가지 않고, 문서화 도구처럼 결과물만 남기지도 않는다. 핵심은 웹과 Desktop 사이의 파일 흐름을 자동으로 복원해 매뉴얼과 Live Guide로 재사용하는 것이다.

## 19. 개발 단계

### Phase 1. 설치 및 연결 검증

- Desktop App skeleton 생성
- Windows 설치 파일 생성
- 설치 시 Native Messaging host 등록
- Web App에서 Desktop App 연결 상태 확인
- Chrome Extension과 Desktop App 연결

성공 기준:

- 사용자가 3분 이내에 설치와 연결 확인을 완료할 수 있다.
- 설치 후 Web App에서 Desktop 연결 상태가 명확히 표시된다.
- 첫 캡처 전에 Desktop App 연결 실패를 감지할 수 있다.

### Phase 2. 기술 검증

- `capture_session_id` 전달
- 다운로드 폴더 파일 생성/수정 감지
- Desktop 이벤트를 로컬 로그로 저장

성공 기준:

- Web Recorder 기록 시작 시 Desktop App이 같은 세션 ID를 인식한다.
- 웹에서 다운로드한 파일이 Desktop 이벤트로 감지된다.

### Phase 3. 서버 연동

- `desktop_events` ingest API 추가
- Desktop App에서 서버로 이벤트 전송
- 기존 capture session과 이벤트 연결
- finalize 시 Desktop 이벤트 조회

성공 기준:

- 하나의 capture session에서 web_event와 desktop_event를 함께 조회할 수 있다.

### Phase 4. 매뉴얼 생성

- Desktop 이벤트 병합 로직 추가
- `desktop_file_task` 단계 생성
- Manual Editor에서 Desktop 단계 표시 및 수정

성공 기준:

- 다운로드, 파일 수정, 업로드 복귀 흐름이 하나의 매뉴얼에 자연스럽게 포함된다.

### Phase 5. Live Guide 연동

- Desktop 단계 표시
- 파일 열기/폴더 열기 버튼 제공
- 저장 감지 후 다음 단계 진행
- 브라우저 복귀 및 업로드 안내

성공 기준:

- 사용자가 Live Guide를 따라 파일을 열고 저장한 뒤 웹 업로드 단계로 복귀할 수 있다.

## 20. 주요 리스크

- Desktop 앱 설치 과정에서 사용자가 이탈할 수 있다.
- 캡처 전에 설치와 연결을 완료하지 못하면 Desktop 구간 기록이 누락될 수 있다.
- 파일 감지 이벤트가 너무 많으면 노이즈가 커질 수 있다.
- 다운로드 파일과 업로드 파일을 잘못 연결할 수 있다.
- 보안/개인정보 우려가 제품 수용성을 낮출 수 있다.
- Windows 코드 서명과 배포 업데이트가 예상보다 오래 걸릴 수 있다.
- RPA 수준 자동화 기대가 생기면 MVP 범위가 흔들릴 수 있다.

## 21. 미해결 질문

- Desktop App을 무료 기능으로 둘지, Pro/Enterprise 기능으로 둘지 결정해야 한다.
- Mac 지원을 언제 고려할지 정해야 한다.
- 파일 fingerprint를 어디까지 계산할지 결정해야 한다.
- 설치형 앱 없이 Native Messaging 연결이 어려운 고객 환경을 어떻게 처리할지 정해야 한다.
- Desktop 단계에서 스크린샷을 허용할지, 허용한다면 어떤 조건으로 제한할지 정해야 한다.
- 조직 관리자가 Desktop 기록 정책을 어디까지 강제할 수 있는지 정해야 한다.

## 22. 최종 결론

MIMIC Desktop App은 구현 가능하다. 다만 성공 조건은 Desktop을 완전히 자동화하는 것이 아니라, 웹 이벤트와 로컬 파일 이벤트를 같은 세션으로 묶고 그 사이를 문서 단계와 Live Guide 단계로 복원하는 것이다.

MVP의 가장 좋은 목표는 다음이다.

> 웹에서 다운로드한 파일을 Desktop App이 감지하고, 사용자가 수정/저장한 뒤 다시 웹에 업로드하는 과정을 하나의 MIMIC 매뉴얼과 Live Guide로 연결한다.

# Parro Recorder Chrome Web Store 제출 체크리스트

## 업로드 파일

- 패키지: `parro-recorder-v1.0.0.zip`
- 생성 명령: `python build-parro-store-zip.py`
- 확장 이름: `Parro Recorder`
- 카테고리: `Productivity`
- 언어: `한국어`

## 기본 설명

### 짧은 설명

웹페이지 작업을 단계별로 자동 캡처하여 매뉴얼과 가이드를 빠르게 만드는 스크린샷 레코더입니다.

### 상세 설명

Parro Recorder는 웹에서 진행하는 클릭, 입력, 화면 전환을 단계별로 캡처해 매뉴얼과 가이드 초안을 빠르게 만드는 Chrome 확장 프로그램입니다.

반복적으로 설명해야 하는 업무 절차, 고객 안내, 온보딩 문서, 내부 SOP를 만들 때 화면을 하나씩 캡처하고 설명을 정리하는 시간을 줄이는 데 집중합니다.

주요 기능:

- 단계별 자동 캡처: 사용자가 웹페이지에서 작업하면 클릭과 입력 흐름을 순서대로 기록합니다.
- 미리보기 확인: 캡처된 단계와 하이라이트를 사이드패널에서 바로 확인할 수 있습니다.
- 민감정보 보호: 필요한 경우 캡처 이미지에서 민감한 영역을 직접 가릴 수 있습니다.
- 가이드 제작 연동: 캡처한 단계는 웹 서비스로 전송되어 매뉴얼과 Live Guide 제작에 사용됩니다.

## 단일 목적 설명

Parro Recorder의 단일 목적은 사용자가 명시적으로 시작한 녹화 세션 동안 웹 작업 화면과 상호작용 정보를 캡처하여 매뉴얼과 가이드 제작에 필요한 단계 데이터를 생성하는 것입니다.

## 권한 사용 사유

- `activeTab`: 사용자가 현재 보고 있는 탭에서만 캡처와 요소 탐지를 수행하기 위해 필요합니다.
- `tabs`: 녹화 중인 탭을 추적하고 페이지 이동 뒤에도 캡처 흐름을 유지하기 위해 필요합니다.
- `desktopCapture`: 일반 캡처가 제한되는 환경에서 사용자가 직접 화면 공유를 선택해 캡처할 수 있도록 하기 위해 필요합니다.
- `windows`: 사이드패널과 권한 요청 창을 올바른 브라우저 창에서 열기 위해 필요합니다.
- `storage`: 녹화 상태, 설정, 임시 캡처 데이터를 로컬에 저장하기 위해 필요합니다.
- `downloads`: 전체 페이지 캡처 결과를 사용자가 로컬 파일로 저장할 수 있도록 하기 위해 필요합니다.
- `sidePanel`: 녹화 제어, 단계 미리보기, 완료 버튼을 브라우저 사이드패널에 표시하기 위해 필요합니다.
- `scripting`: 페이지 로드 후 캡처 보조 스크립트를 주입하고 화면 상태를 확인하기 위해 필요합니다.
- `offscreen`: 화면 캡처와 오디오 처리처럼 백그라운드 문서가 필요한 작업을 처리하기 위해 필요합니다.
- `<all_urls>`: 사용자가 선택한 어떤 웹사이트에서도 매뉴얼 제작용 녹화를 시작할 수 있어야 하므로 필요합니다.
- `https://*.supabase.co/*`: 캡처 이미지 저장소와 통신하기 위해 필요합니다.

## 개인정보 처리 항목

Chrome Web Store Privacy 탭에서 다음 성격의 데이터 수집을 선언해야 합니다.

- 웹사이트 콘텐츠: 사용자가 녹화 중 캡처한 스크린샷과 화면 정보
- 사용자 활동: 클릭 좌표, 입력 완료 시점, 페이지 URL 등 단계 생성에 필요한 동작 정보
- 오디오: 사용자가 음성 설명 기능을 직접 켠 경우에만 사용

사용 목적:

- 앱 기능 제공: 매뉴얼과 가이드 생성
- 분석/광고/판매 목적 없음

제3자 처리:

- Supabase: 이미지와 캡처 데이터 저장
- AI 분석 제공자: 사용자가 요청한 설명 생성 또는 음성 처리

## 그래픽 자산

Chrome 공식 문서 기준으로 다음 자산이 필요합니다.

- 스토어 아이콘: 128x128 PNG
- 스크린샷: 최소 1장, 최대 5장, 1280x800 권장
- 작은 프로모션 타일: 440x280 PNG 또는 JPEG 필수
- 마키 프로모션 타일: 1400x560 PNG 또는 JPEG 선택

현재 `build-parro-store-zip.py`는 기존 `icons/` 파일을 사용합니다. 정식 공개 전 Parro 브랜드 아이콘으로 교체하는 것을 권장합니다.

## 사용자가 직접 해야 하는 작업

1. Chrome Web Store Developer Dashboard에서 `Add new item`을 선택하고 `parro-recorder-v1.0.0.zip`을 업로드합니다.
2. 업로드 후 생성된 Parro 확장 프로그램의 Item ID를 확인합니다.
3. Package 탭에서 public key를 확인하고, 필요하면 개발 테스트용 manifest key로 별도 관리합니다.
4. Store Listing 탭에서 이름, 설명, 스크린샷, 작은 프로모션 타일, 지원 URL, 홈페이지 URL을 입력합니다.
5. Privacy 탭에서 단일 목적, 권한 사유, 데이터 사용 항목을 위 내용대로 작성합니다.
6. Distribution 탭에서 공개 범위와 국가를 선택합니다.
7. 실제 Parro 계정으로 로그인/연동/녹화/전송까지 테스트한 뒤 `Submit for Review`를 누릅니다.

## 업로드 전 로컬 검증

```powershell
node --check background.js
node --check content.js
node --check popup.js
node --check guide-engine.js
python build-parro-store-zip.py
```

ZIP 확인:

```powershell
Expand-Archive .\parro-recorder-v1.0.0.zip -DestinationPath $env:TEMP\parro-recorder-check -Force
Get-Content $env:TEMP\parro-recorder-check\manifest.json -Encoding UTF8
```

# MIMIC — 프로젝트 총괄 개요

> **Don't Explain, Just Mimic.**
> 말로 설명하지 마세요. 화면을 캡처하면 AI가 인터랙티브 매뉴얼로 만들어드립니다.

---

## 서비스 본질

팀원이나 고객에게 소프트웨어 사용법을 전달할 때, PDF·Loom·말 대신 **클릭 한 번으로 따라할 수 있는 가이드**를 만드는 도구.

캡처 → AI 처리 → 편집 → 공유의 전 과정을 하나의 파이프라인으로 제공.

경쟁사(Tango): Enterprise 전용 고가 기능을 MIMIC은 Pro 수준에서 제공.

---

## 디렉토리 구조

```
Dev/mimic/                  ← 이 세션 (총괄 PM)
  ├── mimic_app/            ← Next.js 웹 서비스
  └── mimic_recorder/       ← Chrome Extension (캡처 도구)
```

---

## 각 프로젝트 역할

### mimic_recorder (Chrome Extension)
- 사용자의 화면 클릭을 감지하고 스크린샷 캡처
- 캡처한 이미지를 Supabase Storage에 업로드
- 확장 연결 토큰으로 mimic_app API를 인증하여 데이터 전송
- **담당 세션:** mimic_recorder 디렉토리에서 직접 작업

### mimic_app (Next.js Web App)
- 캡처 데이터를 받아 AI로 매뉴얼 자동 생성
- 에디터에서 제목·스크립트·마커 편집
- TTS 음성 생성 및 인터랙티브 플레이어 제공
- 공유 링크(`/play/[token]`)로 외부 배포
- **담당 세션:** mimic_app 디렉토리에서 직접 작업

---

## 전체 파이프라인

```
[사용자 — 브라우저]
  1. mimic_app에서 로그인
  2. /extension-link 에서 1회용 토큰 발급

[mimic_recorder — Chrome Extension]
  3. 토큰 수신 → 사용자 계정과 연결
  4. 화면 캡처 시작 (클릭 이벤트 감지)
  5. 스크린샷 → Supabase Storage (naviaction 버킷)
  6. POST /api/capture/analyze → Claude Vision → 제목·설명 자동 생성
  7. POST /api/capture/save-step → DB(MM_steps)에 저장

[mimic_app — Web Editor]
  8. 대시보드에서 캡처된 튜토리얼 확인
  9. 에디터에서 제목·스크립트·마커 편집
  10. POST /api/generate-script → Claude → TTS 스크립트 생성
  11. POST /api/tts → OpenAI → 음성 파일 생성 및 Storage 저장
  12. POST /api/tutorials/[id]/publish → share_token 발급

[시청자 — 외부 공유]
  13. GET /play/[token] → 인터랙티브 매뉴얼 실행
  14. 시청 이벤트 로깅 → 완독률·이탈 분석
```

---

## 크로스 프로젝트 연결 지점

| 연결 지점 | recorder 측 | app 측 |
|-----------|------------|--------|
| 사용자 인증 | Bearer extension token 첨부 | `POST /api/extension/verify` |
| 스크린샷 저장 | Storage 직접 업로드 | `naviaction` 버킷 URL 참조 |
| AI 분석 요청 | `POST /api/capture/analyze` | Claude Vision 처리 후 응답 |
| 스텝 저장 | `POST /api/capture/save-step` | MM_steps INSERT |
| session_id | 캡처 세션 ID 생성 | MM_tutorials.session_id로 매핑 |

---

## 공유 인프라

| 항목 | 값 |
|------|----|
| Supabase 인스턴스 | `gqynptpjomcqzxyykqic` (mimic_app·recorder 공유) |
| Storage 버킷 (스크린샷) | `naviaction` |
| Storage 버킷 (TTS) | `mimic-tts` |
| 웹 도메인 | `mimicflow.com` |
| 확장 이름 | MIMIC Recorder |

---

## 이 세션(루트 PM)의 역할

**여기서 다룰 것:**
- 두 프로젝트에 걸친 플로우 설계 및 변경
- 크로스 프로젝트 API 계약 변경 논의
- 전체 아키텍처 결정

**여기서 다루지 않을 것 (각 프로젝트 세션으로):**
- mimic_app 단독 기능 구현 → mimic_app 세션
- mimic_recorder 단독 기능 구현 → mimic_recorder 세션
- DB 스키마·API 명세 상세 → `mimic_app/PLAN.md` 참조
- 로드맵 Phase 계획 → `mimic_app/PLAN.md` 참조

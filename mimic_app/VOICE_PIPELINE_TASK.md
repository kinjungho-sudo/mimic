# 작업 지시서 — 통합 음성 파이프라인 완성 (APP)

> 작성일: 2026-06-15 · 대상: `mimic_app` (웹앱) · 상태: 착수 대기
> 전제: 레코더(`mimic_recorder`) 측은 이미 필요한 데이터(텍스트·사람음성·구간)를 finalize로 넘김. **앱은 해석·생성·재생·게이팅만 구현한다.**

---

## 1. 제품 방향 (확정)

> **한 번 녹화(선택적으로 말하기) → AI가 행동+전사로 스텝별 텍스트 자동 작성 → 관리자가 검토·삭제·수정 → "음성 듣기"는 다듬은 텍스트의 TTS가 기본, 사람 녹음 클립이 있는 스텝만 그 클립으로 덮어씀.**

- **음성을 안 써도 텍스트 매뉴얼이 완성되는 'AI 텍스트 바닥'이 필수.**
- **TTS(텍스트→음성)가 기본 엔진** (수정·다국어·재생성 가능), **사람 음성은 per-step 덮어쓰기 옵션.**
- "A(녹화 중 내레이션) vs B(사후 스텝별 작업)"는 양자택일이 아니라 **A=입력 / B=편집**의 순차 파이프라인. AI 텍스트+TTS가 중심.

## 2. 레코더 계약 (이미 구현됨 — 수정 금지, 소비만)

`POST /api/capture/finalize` 가 다음을 처리해 `mm_steps`에 저장:

- **`audio_url`** (연속 내레이션): 서버 Whisper 전사 → `audio_offset_ms` 기준 스텝 구간 배분 → `cleanTranscripts` →
  - `user_script` (다듬은 텍스트), `voice_transcript_raw` (원문),
  - `voice_audio_url` (세션 음성 파일), `voice_audio_start_ms` / `voice_audio_end_ms` (그 스텝 구간).
- **`step_voice`** (per-step 보정 맵): 해당 스텝 `voice_audio_url` = 개별 클립(구간 null).
- 음성이 전혀 없으면 `generateDraft`가 `user_title`/텍스트 생성 = **AI 텍스트 바닥**.

→ 즉 `mm_steps`에 이미: `user_script`(텍스트), `voice_audio_url`(사람 음성, 있을 수도), 구간 ms 가 들어온다.

## 3. 앱이 이미 가진 것 (먼저 audit 후 재사용·완성)

- `lib/openai-tts.ts` `generateTTS(stepId, scriptText, voice)` → `mimic-tts` 버킷 업로드 + `mm_audio_assets` upsert `{ step_id, audio_url, duration_ms, script_text, voice }`.
- `/api/tts`, `app/manual/[id]/editor/page.tsx`(`ttsEnabled`/`ttsVoice`), `app/play/[token]/page.tsx`(재생), `app/api/play/[token]/route.ts`, `lib/api/ai.ts`.
- **일부 TTS가 이미 붙어 있으니, 새로 만들기 전에 현황을 먼저 파악할 것.**

## 4. 구현 항목 (gap 채우기)

### 4-1. 통합 '음성 해석' 헬퍼 (play / viewer / editor 공통)
스텝의 재생 음성 우선순위:
1. `voice_audio_url`(사람 클립)이 있으면 그것 — 세션 구간이면 `voice_audio_start_ms`/`end_ms`로 시킹, 개별 클립이면 전체 재생.
2. 없으면 `user_script` 기반 **TTS**(`mm_audio_assets.audio_url`).
3. 둘 다 없으면 무음.

### 4-2. TTS ↔ 최종 텍스트 동기화
- `mm_audio_assets.script_text !== 현재 user_script` 이면 **stale** → 재생성(또는 무효화).
- `user_script` 편집/저장 시 해당 스텝 TTS 무효화.
- 발행/미리듣기 시 누락분 일괄 생성.

### 4-3. 에디터 per-step 음성 컨트롤
- 스텝마다 음성 소스 뱃지(**내 음성 / AI 음성 / 없음**) + 재생 버튼.
- **'AI 음성 생성'**(이 스텝 TTS), 전체 **'AI 보이스오버 생성'**(누락 스텝 일괄), 보이스 선택.
- **(B 보정) 스텝별 '내 음성 재녹음'** — 에디터에서 녹음 → 버킷 업로드 → `mm_steps.voice_audio_url` 덮어씀(구간 null).
  ※ 레코더의 단일 마이크 스트림 충돌과 무관한 **올바른 위치**. 이번 단계 또는 후속으로.

### 4-4. 따라하기(play) / 뷰어 재생
- 스텝 진행 시 4-1의 해석 음성을 자동 재생.
- 사람 세션 구간은 start/end로 잘라 재생, 개별 클립/TTS는 전체 재생.
- 자동재생 / 일시정지 / 다음 스텝 전환 처리.

### 4-5. PRO 게이팅
- 음성(TTS 생성 · 사람음성 · 따라하기 음성 재생)은 **Pro+** (`mm_users.plan ∈ {pro, enterprise}`).
- Free/Basic 은 텍스트 매뉴얼만(무음).
- 게이팅은 **서버**(요청 시 plan 확인)에서 강제.

### 4-6. AI 텍스트 바닥 품질 확인
- 음성 없이도 `generateDraft` 결과가 쓸 만한지 점검(필요 시 프롬프트 개선).

## 5. 제약
- 레코더(`content.js`/`background.js`) 및 finalize의 **레코더 계약 부분 수정 금지**(소비만).
- 기존 `openai-tts` / `mm_audio_assets` / `mimic-tts` 버킷 / play TTS **재사용 — 중복 구현 금지**.
- DB: `mm_steps`(`user_script`, `voice_audio_url`, `voice_transcript_raw`, `voice_audio_start_ms`/`end_ms`), `mm_audio_assets`(TTS). 새 컬럼 필요 시 마이그레이션 추가.

## 6. 완료 기준 (Acceptance)
- [ ] 음성 0개여도 텍스트 매뉴얼 완성.
- [ ] 녹화 중 말하면 스텝별 설명이 `user_script`에 자동 반영(이미 됨) + 따라하기에서 음성 재생.
- [ ] '음성 듣기'가 **사람 클립 > TTS** 우선순위로 정확히 재생.
- [ ] `user_script` 수정 시 TTS가 stale → 재생성.
- [ ] Pro만 음성 사용 가능, Free/Basic 무음.

## 7. 요금제 매핑 (참고)
| 요금제 | 음성 관련 |
|---|---|
| Free | 데모 (무음) |
| Basic | 자동 문서화 텍스트 매뉴얼 (무음) |
| Pro | + 따라하기(인터랙티브) + TTS 음성 듣기 + 사람 음성 덮어쓰기 |
| Enterprise | 전기능 + 팀/협업 |

## 8. 검증할 가설 (출시 후 측정)
- **H1**: 관리자는 "완벽 내레이션"보다 "일단 하고 AI가 쓰면 가볍게 손본다"를 선호 → *재녹화율 · 편집 분량 · 완성 시간*.
- **H2**: 따라하기 사용자는 무음보다 TTS에서 완주율↑, 사람음성과 만족도 차이 작음 → *스텝 완주율 · 재생 횟수*.
- **H3**: 사람 per-step 재녹음은 전체 스텝의 소수(<10%) → 보정 옵션이 맞다는 근거.

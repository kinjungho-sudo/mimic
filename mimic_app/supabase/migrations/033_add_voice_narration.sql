-- ─────────────────────────────────────────────────────────────────────────────
-- 033_add_voice_narration.sql
-- 음성 설명 녹음 — 녹화 중 마이크로 말한 설명을 Whisper로 전사해 스텝별 배분
-- ─────────────────────────────────────────────────────────────────────────────

-- 캡처 이벤트: 음성 녹음 기준점(audioStartTime) 대비 이 캡처의 상대 시각(ms).
-- finalize에서 Whisper 세그먼트 타임스탬프와 맞춰 스텝별 전사 구간을 가른다.
ALTER TABLE mm_capture_events
  ADD COLUMN IF NOT EXISTS audio_offset_ms integer NULL;

-- 세션: 업로드된 원본 음성 파일 URL (naviaction 버킷의 {session_id}/voice.webm)
ALTER TABLE mm_capture_sessions
  ADD COLUMN IF NOT EXISTS audio_url text NULL;

-- 스텝: 전사 결과 보관
--  voice_transcript_raw : Whisper 원문(다듬기 전) — 에디터 '원본' 토글용
--  voice_audio_url      : 이 스텝 음성을 재생할 원본 파일 URL (세션 공용)
--  voice_audio_start_ms / voice_audio_end_ms : 세션 음성 내 이 스텝 구간 (재생 시킹)
-- (다듬어진 본문은 기존 user_script에 채워 에디터가 자동 로드)
ALTER TABLE mm_steps
  ADD COLUMN IF NOT EXISTS voice_transcript_raw text NULL,
  ADD COLUMN IF NOT EXISTS voice_audio_url       text NULL,
  ADD COLUMN IF NOT EXISTS voice_audio_start_ms  integer NULL,
  ADD COLUMN IF NOT EXISTS voice_audio_end_ms    integer NULL;

COMMENT ON COLUMN mm_capture_events.audio_offset_ms IS '음성 녹음 시작 기준 이 캡처의 상대 시각(ms)';
COMMENT ON COLUMN mm_capture_sessions.audio_url IS '원본 음성 녹음 파일 URL';
COMMENT ON COLUMN mm_steps.voice_transcript_raw IS 'Whisper 전사 원문 (맞춤법 다듬기 전)';
COMMENT ON COLUMN mm_steps.voice_audio_url IS '이 스텝 음성 재생용 원본 파일 URL (세션 공용)';
COMMENT ON COLUMN mm_steps.voice_audio_start_ms IS '세션 음성 내 이 스텝 구간 시작(ms)';
COMMENT ON COLUMN mm_steps.voice_audio_end_ms IS '세션 음성 내 이 스텝 구간 끝(ms)';

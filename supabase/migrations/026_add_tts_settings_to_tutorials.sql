-- TTS 설정을 스텝별이 아닌 튜토리얼 단위로 관리
ALTER TABLE mm_tutorials
  ADD COLUMN IF NOT EXISTS tts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tts_voice   text    NOT NULL DEFAULT 'nova'
    CHECK (tts_voice IN ('nova', 'alloy'));

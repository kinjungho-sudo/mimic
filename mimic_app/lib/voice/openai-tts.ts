import OpenAI from 'openai';
import { createServiceRoleClient } from '../supabase/server';

export async function generateTTS(
  stepId: string,
  scriptText: string,
  voice: 'nova' | 'alloy' | 'cedar' = 'cedar'
): Promise<{ audio_url: string; duration_ms: number }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts',
    voice,
    input: scriptText,
    instructions: /[가-힣]/.test(scriptText)
      ? '밝고 따뜻한 어린 소년 안내자처럼 자연스러운 한국어로 말하세요. 장난스럽게 과장하지 말고, 친절하고 또렷하며 차분한 속도로 설명하세요.'
      : 'Speak like a bright, warm young boy guide. Keep it natural, friendly, clear, and calm without sounding cartoonish.',
    response_format: 'mp3',
    speed: 1.0,
  });

  const buffer = Buffer.from(await response.arrayBuffer());

  // duration 추정: 한국어 기준 분당 약 250글자 → ms 변환
  const charCount = scriptText.length;
  const duration_ms = Math.round((charCount / 250) * 60 * 1000);

  const supabase = createServiceRoleClient();
  const filePath = `tts/${stepId}.mp3`;

  const { error: uploadError } = await supabase.storage
    .from('mimic-tts')
    .upload(filePath, buffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`TTS upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from('mimic-tts').getPublicUrl(filePath);

  await supabase
    .from('mm_audio_assets')
    .upsert(
      {
        step_id: stepId,
        audio_url: urlData.publicUrl,
        duration_ms,
        script_text: scriptText,
        voice,
      },
      { onConflict: 'step_id' }
    );

  return { audio_url: urlData.publicUrl, duration_ms };
}

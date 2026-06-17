import OpenAI from 'openai';
import { createServiceRoleClient } from './supabase/server';

export async function generateTTS(
  stepId: string,
  scriptText: string,
  voice: 'nova' | 'alloy' = 'nova'
): Promise<{ audio_url: string; duration_ms: number }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice,
    input: scriptText,
    response_format: 'mp3',
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

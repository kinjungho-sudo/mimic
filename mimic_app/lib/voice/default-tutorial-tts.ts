import { hasEntitlement } from '@/lib/entitlements';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateTTS } from '@/lib/voice/openai-tts';

export const DEFAULT_TUTORIAL_TTS_VOICE = 'cedar' as const;
export const DEFAULT_TUTORIAL_TTS_SETTING_VOICE = 'alloy' as const;

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export async function canGenerateDefaultTutorialTTS(
  userId: string,
  workspaceId: string | null,
  supabase: ServiceClient,
): Promise<boolean> {
  let billingUserId = userId;
  if (workspaceId) {
    const { data: workspace } = await supabase
      .from('mm_workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle();
    if (!workspace?.owner_id) return false;
    billingUserId = workspace.owner_id;
  }

  const { data: user } = await supabase
    .from('mm_users')
    .select('plan')
    .eq('id', billingUserId)
    .maybeSingle();
  return hasEntitlement(user?.plan, 'ai_voice');
}

export async function generateDefaultTutorialTTS(
  tutorialId: string,
  supabase: ServiceClient = createServiceRoleClient(),
): Promise<{ generated: number; failed: number }> {
  const { data: steps, error: stepsError } = await supabase
    .from('mm_steps')
    .select('id, user_script, ai_description')
    .eq('tutorial_id', tutorialId)
    .order('step_number', { ascending: true });

  if (stepsError) throw new Error(`Default TTS steps lookup failed: ${stepsError.message}`);

  const targets = (steps ?? []).map(step => ({
    id: step.id,
    script: String(step.user_script || step.ai_description || '').trim(),
  })).filter(step => step.script.length > 0);

  let generated = 0;
  let failed = 0;
  // Keep concurrency modest so a long manual does not burst the speech API.
  for (let index = 0; index < targets.length; index += 3) {
    const results = await Promise.allSettled(
      targets.slice(index, index + 3).map(step => generateTTS(step.id, step.script, DEFAULT_TUTORIAL_TTS_VOICE)),
    );
    generated += results.filter(result => result.status === 'fulfilled').length;
    failed += results.filter(result => result.status === 'rejected').length;
  }

  return { generated, failed };
}

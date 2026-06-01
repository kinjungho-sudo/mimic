import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  agreements: z.object({
    age14: z.literal(true),
    terms: z.literal(true),
    privacy: z.literal(true),
    marketing: z.boolean(),
  }),
});

export const captureFinalizeSchema = z.object({
  session_id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
});

// input[type=password/tel 등] 또는 민감 aria-label이면 label도 제거하는 변환
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SENSITIVE_INPUT_TYPES_RE = /^(password|tel|credit.?card|cc.?num|ssn)$/i;
const SENSITIVE_LABEL_RE = /비밀번호|패스워드|암호|password|카드.?번호|card.?number|주민.?번호|주민.?등록|rrn|ssn|계좌.?번호|account.?number|cvv|cvc|보안.?코드|security.?code|\bpin\b|otp|인증.?번호|인증.?코드|verification.?code|토큰|token|\bsecret\b|api.?key/i;

export const actionInfoSchema = z.object({
  type: z.enum(['click', 'navigate', 'toggle', 'select', 'focus_input', 'type']),
  label: z.string().max(200).optional(),
  tag: z.string().max(30).optional(),
  role: z.string().max(50).optional(),
  href: z.string().max(500).optional(),
  // text(실제 입력값)와 inputType은 수신하되 즉시 폐기 — password 등 민감정보가 서버/AI에 도달하지 않도록
  text: z.string().max(1000).optional().transform(() => undefined),
  inputType: z.string().max(30).optional().transform(() => undefined),
}).transform(data => {
  // input type이 민감하거나 label 자체가 민감 패턴이면 label도 제거
  const rawLabel = (data as { label?: string }).label;
  if (rawLabel && SENSITIVE_LABEL_RE.test(rawLabel)) {
    return { ...data, label: undefined };
  }
  return data;
}).optional();

export const captureAnalyzeSchema = z.object({
  image: z.string().min(1),
  url: z.string().url(),
  actionInfo: actionInfoSchema,
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).optional(),
});

export const captureSaveStepSchema = z.object({
  session_id: z.string().uuid(),
  step_number: z.number().int().positive(),
  screenshot_url: z.string().url(),
  click_x: z.number().min(0).max(1),
  click_y: z.number().min(0).max(1),
  title: z.string().max(100).optional().default(''),
  description: z.string().max(500).optional().default(''),
  url: z.string().url(),
  domain_hostname: z.string().max(200).optional().nullable(),
  domain_name:     z.string().max(200).optional().nullable(),
  domain_favicon:  z.string().max(500).optional().nullable(),
  viewport_w:        z.number().int().positive().optional().nullable(),
  viewport_h:        z.number().int().positive().optional().nullable(),
  element_selector:  z.string().max(500).optional().nullable(),
  element_xpath:     z.string().max(500).optional().nullable(),
});

export const tutorialPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  mode: z.enum(['interactive', 'guide']).optional(),
  status: z.enum(['draft', 'published']).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  output_ratio: z.enum(['16:9', '1:1', '9:16']).optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  workspace_id: z.string().uuid().nullable().optional(),
  share_password: z.string().max(100).nullable().optional(),
});

export const generateScriptSchema = z.object({
  steps: z.array(z.object({
    id: z.string(),
    tutorial_id: z.string(),
    step_number: z.number(),
    order_index: z.number(),
    screenshot_url: z.string(),
    page_url: z.string().nullable(),
    ai_title: z.string().nullable(),
    ai_description: z.string().nullable(),
    user_title: z.string().nullable(),
    user_script: z.string().nullable(),
    created_at: z.string(),
  })),
  userDraft: z.string().optional(),
});

export const generateMarkersSchema = z.object({
  steps: z.array(z.object({
    id: z.string(),
    tutorial_id: z.string(),
    step_number: z.number(),
    order_index: z.number(),
    screenshot_url: z.string(),
    page_url: z.string().nullable(),
    ai_title: z.string().nullable(),
    ai_description: z.string().nullable(),
    user_title: z.string().nullable(),
    user_script: z.string().nullable(),
    created_at: z.string(),
  })),
});

export const generateAnnotationsSchema = z.object({
  stepId: z.string().uuid(),
  userPrompt: z.string().min(1).max(500),
});

export const ttsSchema = z.object({
  stepId: z.string().uuid(),
  scriptText: z.string().min(1).max(2000),
  voice: z.enum(['nova', 'alloy']).optional(),
});

export const eventsSchema = z.object({
  tutorial_id: z.string().uuid(),
  viewer_session_id: z.string().min(1),
  event_type: z.enum(['enter', 'step', 'complete', 'exit']),
  step_number: z.number().int().positive().optional(),
});

export const surveySchema = z.object({
  tutorial_id: z.string().uuid(),
  viewer_session_id: z.string().min(1),
  q1_easier_than_pdf: z.number().int().min(1).max(5),
  q2_would_use_again: z.number().int().min(1).max(5),
  q3_useful_for_work: z.number().int().min(1).max(5),
  q4_can_reproduce: z.boolean(),
  q5_additional_feedback: z.string().max(1000).optional(),
});

export const proSignupSchema = z.object({
  email: z.string().email(),
  plan_interested: z.enum(['pro', 'team']),
  source: z.enum(['landing', 'editor', 'limit_modal', 'mypage']),
  user_id: z.string().uuid().optional(),
});

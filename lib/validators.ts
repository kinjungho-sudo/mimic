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

export const captureAnalyzeSchema = z.object({
  image: z.string().min(1),
  url: z.string().url(),
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
});

export const tutorialPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  mode: z.enum(['interactive', 'guide']).optional(),
  status: z.enum(['draft', 'published']).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  output_ratio: z.enum(['16:9', '1:1', '9:16']).optional(),
  thumbnail_url: z.string().url().nullable().optional(),
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

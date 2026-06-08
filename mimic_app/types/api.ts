import type { Tutorial, TutorialDetail, Step, Marker, Annotation, AudioAsset, User } from './index';

// ─────────────────────────────
// Auth
// ─────────────────────────────
export type SignupWithAgreementsBody = {
  name: string;
  email: string;
  password: string;
  agreements: {
    age14: boolean;
    terms: boolean;
    privacy: boolean;
    marketing: boolean;
  };
};

export type AuthResponse = {
  user: User;
  session: { access_token: string; refresh_token: string };
};

// ─────────────────────────────
// Extension
// ─────────────────────────────
export type ExtensionLinkResponse = {
  token: string;
  expiresAt: string;
};

export type ExtensionVerifyResponse = {
  user_id: string;
  email: string;
};

// ─────────────────────────────
// Capture
// ─────────────────────────────
export type CaptureAnalyzeBody = {
  image: string;
  url: string;
};

export type CaptureAnalyzeResponse = {
  title: string;
  description: string;
};

export type CaptureSaveStepBody = {
  session_id: string;
  step_number: number;
  screenshot_url: string;
  click_x: number;
  click_y: number;
  title: string;
  description: string;
  url: string;
};

export type CaptureSaveStepResponse = {
  id: string;
  step_number: number;
};

// ─────────────────────────────
// Tutorials
// ─────────────────────────────
export type TutorialsListResponse = Tutorial[];

export type TutorialPatchBody = Partial<
  Pick<Tutorial, 'title' | 'mode' | 'status' | 'visibility' | 'output_ratio'>
> & {
  steps?: Array<Partial<Step>>;
};

export type PublishResponse = {
  share_token: string;
  share_url: string;
};

// ─────────────────────────────
// AI Generation
// ─────────────────────────────
export type GenerateScriptBody = {
  steps: Step[];
  userDraft?: string;
};

export type GenerateScriptResponse = {
  script: string;
  markerPositions: number[];
};

export type GenerateMarkersBody = {
  steps: Step[];
};

export type GenerateMarkersResponse = {
  markers: Marker[];
};

export type GenerateAnnotationsBody = {
  stepId: string;
  userPrompt: string;
};

export type GenerateAnnotationsResponse = {
  annotations: Annotation[];
};

export type TtsBody = {
  stepId: string;
  scriptText: string;
  voice?: 'nova' | 'alloy';
};

export type TtsResponse = {
  audio_url: string;
  duration_ms: number;
};

// ─────────────────────────────
// Events / Survey / Pro Signup
// ─────────────────────────────
export type EventsBody = {
  tutorial_id: string;
  viewer_session_id: string;
  event_type: 'enter' | 'step' | 'complete' | 'exit';
  step_number?: number;
};

export type SurveyBody = {
  tutorial_id: string;
  viewer_session_id: string;
  q1_easier_than_pdf: number;
  q2_would_use_again: number;
  q3_useful_for_work: number;
  q4_can_reproduce: boolean;
  q5_additional_feedback?: string;
};

export type ProSignupBody = {
  email: string;
  plan_interested: 'pro' | 'team';
  source: 'landing' | 'editor' | 'limit_modal' | 'mypage';
  user_id?: string;
};

export type ProSignupResponse = {
  success: true;
  message: string;
};

// ─────────────────────────────
// Shared
// ─────────────────────────────
export type ApiError = {
  error: string;
  code?: string;
};

export type { TutorialDetail, AudioAsset };

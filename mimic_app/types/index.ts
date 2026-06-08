// ─────────────────────────────
// User
// ─────────────────────────────
export type User = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  auth_provider: 'email' | 'google';
  plan: 'free' | 'pro_waitlist' | 'pro' | 'team';
  daily_manual_count: number;
  daily_limit: number;
  agreements: Agreements;
  created_at: string;
};

export type Agreements = {
  age14: boolean;
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
  agreed_at: string;
};

// ─────────────────────────────
// Tutorial
// ─────────────────────────────
export type Tutorial = {
  id: string;
  user_id: string;
  title: string;
  session_id: string | null;
  mode: 'interactive' | 'guide';
  status: 'draft' | 'published';
  visibility: 'private' | 'public';
  share_token: string | null;
  output_ratio: '16:9' | '1:1' | '9:16';
  created_at: string;
  updated_at: string;
  published_at: string | null;
  cover_color?: string | null;
  thumbnail_url?: string | null;
  first_page_url?: string | null;
  folder_id?: string | null;
  workspace_id?: string | null;
  // enriched by list API
  step_count?: number;
};

// ─────────────────────────────
// Folder
// ─────────────────────────────
export type Folder = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export type TutorialDetail = Tutorial & {
  steps: Step[];
  markers: Marker[];
  audio_assets: AudioAsset[];
  annotations?: Annotation[];
};

// ─────────────────────────────
// Step / Marker / Annotation
// ─────────────────────────────
export type Step = {
  id: string;
  tutorial_id: string;
  step_number: number;
  order_index: number;
  screenshot_url: string;
  page_url: string | null;
  ai_title: string | null;
  ai_description: string | null;
  user_title: string | null;
  user_script: string | null;
  user_annotations?: unknown[] | null;
  domain_hostname?: string | null;
  domain_name?:     string | null;
  domain_favicon?:  string | null;
  created_at: string;
};

export type Marker = {
  id: string;
  step_id: string;
  marker_number: number;
  position_x: number;
  position_y: number;
  script_offset_ms: number;
  connected_effects: Array<'click_sound' | 'zoom_in' | 'typing'>;
  typing_text: string | null;
  ai_generated: boolean;
  created_at: string;
};

export type Annotation = {
  id: string;
  step_id: string;
  marker_id: string | null;
  type: 'text' | 'arrow' | 'rectangle' | 'circle' | 'underline';
  style: Record<string, unknown>;
  geometry: Record<string, unknown>;
  show_duration_ms: number;
  created_at: string;
};

// ─────────────────────────────
// Audio / Events / Pro Signup
// ─────────────────────────────
export type AudioAsset = {
  id: string;
  step_id: string;
  audio_url: string;
  duration_ms: number;
  script_text: string;
  voice: 'nova' | 'alloy';
  created_at: string;
};

export type ViewEvent = {
  tutorial_id: string;
  viewer_session_id: string;
  event_type: 'enter' | 'step' | 'complete' | 'exit';
  step_number?: number;
};

export type SurveyData = {
  tutorial_id: string;
  viewer_session_id: string;
  q1_easier_than_pdf: 1 | 2 | 3 | 4 | 5;
  q2_would_use_again: 1 | 2 | 3 | 4 | 5;
  q3_useful_for_work: 1 | 2 | 3 | 4 | 5;
  q4_can_reproduce: boolean;
  q5_additional_feedback?: string;
};

export type ProSignupData = {
  email: string;
  plan_interested: 'pro' | 'team';
  source: 'landing' | 'editor' | 'limit_modal' | 'mypage';
  user_id?: string;
};

// ─────────────────────────────
// Workspace
// ─────────────────────────────
export type WorkspaceRole = 'admin' | 'editor' | 'viewer';

export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  // enriched
  member_count?: number;
  my_role?: WorkspaceRole;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  // enriched
  user?: { name: string; email: string; avatar_url: string | null };
};

export type WorkspaceInvitation = {
  id: string;
  workspace_id: string;
  inviter_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  created_at: string;
};

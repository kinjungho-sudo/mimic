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
  content_mode?: 'action' | 'education';
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

// ─────────────────────────────
// 플레이북 (여러 가이드를 엮는 큐레이션 문서) — BlockNote 문서
// ─────────────────────────────
export type PageAuthor = { name: string | null; email: string | null; avatar_url: string | null };

export type Page = {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  status: 'draft' | 'published';
  visibility: 'private' | 'public';
  share_token: string | null;
  cover_color?: string | null;
  folder_id?: string | null;
  workspace_id?: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  // enriched by list API
  block_count?: number;
};

export type PageDetail = Page & {
  content: unknown[]; // BlockNote 문서 (Block[])
  author?: PageAuthor | null;
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
// 따라하기 스튜디오 저작 데이터 — null/미설정 필드는 자동추론 사용
export type FollowConfig = {
  hotspotX?: number | null;   // 0~100 (%) 핫스팟 위치 오버라이드. 미설정=녹화 click 좌표
  hotspotY?: number | null;
  kind?: 'click' | 'type' | 'none' | null;  // 인디케이터 종류 오버라이드. 미설정=제목 휴리스틱, none=핫스팟 미표시
  typeText?: string | null;        // 텍스트(type) 인디케이터에 입력될 실제 텍스트. 뷰어에서 자동 타이핑 애니메이션, 라이브 가이드에서 자동 입력
  typeInputMode?: 'copy' | 'auto' | null; // 학습 가이드 입력 방식. copy=복사 후 직접 입력, auto=자동 타이핑 연출
  typeBoxWidth?: number | null;    // 텍스트 입력 인디케이터 너비(px)
  typeBoxHeight?: number | null;   // 텍스트 입력 인디케이터 높이(px)
  hidden?: boolean;                // 따라하기에서 이 스텝 제외 (슬라이드엔 유지)
  bubbleAnchor?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null; // 말풍선 고정 위치. 미설정=핫스팟 상대 위치(자동)
  zoomAnim?: boolean;              // 학습 가이드에서 클릭 영역 확대 애니메이션 사용 (기본 off — 스튜디오에서 켤 때만)
  // 제목·설명은 follow_config에 두지 않는다 — user_title/user_script(문서 매뉴얼과 공유)에 직접 저장
};

export type StepType =
  | 'normal_interactive_step'
  | 'visual_only_step'
  | 'visual_overlay_step'
  | 'manual_capture_step'
  | 'blocked_step'
  | 'skipped_step';

export type CaptureSource = 'auto' | 'manual' | 'none';

export type Step = {
  id: string;
  tutorial_id: string;
  step_number: number;
  order_index: number;
  screenshot_url: string | null;
  page_url: string | null;
  ai_title: string | null;
  ai_description: string | null;
  user_title: string | null;
  user_script: string | null;
  voice_transcript_raw?: string | null;
  voice_audio_url?: string | null;
  voice_audio_start_ms?: number | null;
  voice_audio_end_ms?: number | null;
  user_annotations?: unknown[] | null;
  follow_config?: FollowConfig | null;
  element_selector?: string | null;
  element_xpath?: string | null;
  element_rect?: { x: number; y: number; width: number; height: number } | null;
  target_context?: Record<string, unknown> | null;
  click_x?: number | null;
  click_y?: number | null;
  type_text?: string | null;
  step_type?: StepType | null;
  capture_source?: CaptureSource | null;
  capture_failure_reason?: string | null;
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

import type { User, Tutorial, TutorialDetail, Step, Marker, AudioAsset } from '@/types';

export const MOCK_USER: User = {
  id: 'mock-user-1',
  email: 'demo@mimicflow.com',
  name: '김정호',
  avatar_url: null,
  auth_provider: 'google',
  plan: 'free',
  daily_manual_count: 1,
  daily_limit: 3,
  agreements: {
    age14: true,
    terms: true,
    privacy: true,
    marketing: false,
    agreed_at: '2026-05-26T00:00:00.000Z',
  },
  created_at: '2026-05-26T00:00:00.000Z',
};

export const MOCK_TUTORIALS: Tutorial[] = [
  {
    id: 'mock-tutorial-1',
    user_id: 'mock-user-1',
    title: 'Supabase 프로젝트 시작하기',
    session_id: 'session-abc123',
    mode: 'interactive',
    status: 'draft',
    visibility: 'private',
    share_token: null,
    output_ratio: '16:9',
    created_at: '2026-05-26T10:00:00.000Z',
    updated_at: '2026-05-26T10:30:00.000Z',
    published_at: null,
  },
  {
    id: 'mock-tutorial-2',
    user_id: 'mock-user-1',
    title: 'Google OAuth 설정 가이드',
    session_id: 'session-def456',
    mode: 'interactive',
    status: 'published',
    visibility: 'public',
    share_token: 'mock-share-token-xyz',
    output_ratio: '16:9',
    created_at: '2026-05-25T09:00:00.000Z',
    updated_at: '2026-05-25T12:00:00.000Z',
    published_at: '2026-05-25T12:00:00.000Z',
  },
];

export const MOCK_STEPS: Step[] = [
  {
    id: 'mock-step-1',
    tutorial_id: 'mock-tutorial-1',
    step_number: 1,
    order_index: 0,
    screenshot_url: '/mock/screenshot-1.jpg',
    page_url: 'https://supabase.com/dashboard',
    ai_title: 'Start your project',
    ai_description: 'Supabase 대시보드에 접속합니다.',
    user_title: null,
    user_script: null,
    created_at: '2026-05-26T10:00:00.000Z',
  },
  {
    id: 'mock-step-2',
    tutorial_id: 'mock-tutorial-1',
    step_number: 2,
    order_index: 1,
    screenshot_url: '/mock/screenshot-2.jpg',
    page_url: 'https://supabase.com/dashboard/new',
    ai_title: '조직 이름 입력',
    ai_description: '조직 이름 필드를 클릭합니다.',
    user_title: null,
    user_script: null,
    created_at: '2026-05-26T10:01:00.000Z',
  },
  {
    id: 'mock-step-3',
    tutorial_id: 'mock-tutorial-1',
    step_number: 3,
    order_index: 2,
    screenshot_url: '/mock/screenshot-3.jpg',
    page_url: 'https://supabase.com/dashboard/new',
    ai_title: '지역 선택',
    ai_description: '서버 지역을 선택합니다.',
    user_title: null,
    user_script: null,
    created_at: '2026-05-26T10:02:00.000Z',
  },
];

export const MOCK_MARKERS: Marker[] = [
  {
    id: 'mock-marker-1',
    step_id: 'mock-step-1',
    marker_number: 1,
    position_x: 0.5,
    position_y: 0.3,
    script_offset_ms: 0,
    connected_effects: ['click_sound'],
    typing_text: null,
    ai_generated: true,
    created_at: '2026-05-26T10:00:00.000Z',
  },
];

export const MOCK_AUDIO: AudioAsset[] = [
  {
    id: 'mock-audio-1',
    step_id: 'mock-step-1',
    audio_url: '/mock/audio-1.mp3',
    duration_ms: 8200,
    script_text: '좌측 사이드바의 Authentication 메뉴를 선택합니다.',
    voice: 'nova',
    created_at: '2026-05-26T10:00:00.000Z',
  },
];

export const MOCK_TUTORIAL_DETAIL: TutorialDetail = {
  ...MOCK_TUTORIALS[0],
  steps: MOCK_STEPS,
  markers: MOCK_MARKERS,
  audio_assets: MOCK_AUDIO,
  annotations: [],
};

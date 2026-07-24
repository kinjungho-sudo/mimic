// Supabase DB 테이블 Row 타입 (수동 정의)
// npx supabase gen types 가 가능해지면 이 파일을 자동생성본으로 교체

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      mm_users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          auth_provider: string;
          plan: 'free' | 'pro_waitlist' | 'pro' | 'team';
          daily_manual_count: number;
          daily_limit: number;
          agreements: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          auth_provider?: string;
          plan?: 'free' | 'pro_waitlist' | 'pro' | 'team';
          daily_manual_count?: number;
          daily_limit?: number;
          agreements?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_users']['Insert']>;
      };
      mm_user_onboarding_progress: {
        Row: {
          user_id: string;
          guide_key: string;
          guide_version: number;
          status: 'not_started' | 'in_progress' | 'completed' | 'dismissed';
          current_step: string | null;
          initial_completed_at: string | null;
          last_started_at: string | null;
          last_completed_at: string | null;
          dismissed_at: string | null;
          run_count: number;
          practice_manual_id: string | null;
          impression_at: string | null;
          practice_capture_token: string | null;
          practice_capture_token_issued_at: string | null;
          practice_capture_consumed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          guide_key: string;
          guide_version: number;
          status?: 'not_started' | 'in_progress' | 'completed' | 'dismissed';
          current_step?: string | null;
          initial_completed_at?: string | null;
          last_started_at?: string | null;
          last_completed_at?: string | null;
          dismissed_at?: string | null;
          run_count?: number;
          practice_manual_id?: string | null;
          impression_at?: string | null;
          practice_capture_token?: string | null;
          practice_capture_token_issued_at?: string | null;
          practice_capture_consumed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_user_onboarding_progress']['Insert']>;
      };
      mm_onboarding_events: {
        Row: {
          id: string;
          user_id: string;
          guide_key: string;
          guide_version: number;
          event_type: 'onboarding_impression' | 'start' | 'step_view' | 'step_complete' | 'blocked' | 'install_clicked' | 'resume' | 'dismiss' | 'complete' | 'replay_start';
          step_id: string | null;
          browser_type: string | null;
          extension_state: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          guide_key: string;
          guide_version: number;
          event_type: 'onboarding_impression' | 'start' | 'step_view' | 'step_complete' | 'blocked' | 'install_clicked' | 'resume' | 'dismiss' | 'complete' | 'replay_start';
          step_id?: string | null;
          browser_type?: string | null;
          extension_state?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_onboarding_events']['Insert']>;
      };
      mm_extension_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          used_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          used_at?: string | null;
          expires_at: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_extension_tokens']['Insert']>;
      };
      mm_tutorials: {
        Row: {
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
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          session_id?: string | null;
          mode?: 'interactive' | 'guide';
          status?: 'draft' | 'published';
          visibility?: 'private' | 'public';
          share_token?: string | null;
          output_ratio?: '16:9' | '1:1' | '9:16';
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['mm_tutorials']['Insert']>;
      };
      mm_steps: {
        Row: {
          id: string;
          tutorial_id: string;
          step_number: number;
          order_index: number;
          screenshot_url: string;
          image_alt_text: string | null;
          page_url: string | null;
          ai_title: string | null;
          ai_description: string | null;
          user_title: string | null;
          user_script: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tutorial_id: string;
          step_number: number;
          order_index?: number;
          screenshot_url: string;
          image_alt_text?: string | null;
          page_url?: string | null;
          ai_title?: string | null;
          ai_description?: string | null;
          user_title?: string | null;
          user_script?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_steps']['Insert']>;
      };
      mm_markers: {
        Row: {
          id: string;
          step_id: string;
          marker_number: number;
          position_x: number;
          position_y: number;
          script_offset_ms: number;
          connected_effects: Json;
          typing_text: string | null;
          ai_generated: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          step_id: string;
          marker_number: number;
          position_x: number;
          position_y: number;
          script_offset_ms?: number;
          connected_effects?: Json;
          typing_text?: string | null;
          ai_generated?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_markers']['Insert']>;
      };
      mm_annotations: {
        Row: {
          id: string;
          step_id: string;
          marker_id: string | null;
          type: 'text' | 'arrow' | 'rectangle' | 'circle' | 'underline';
          style: Json;
          geometry: Json;
          show_duration_ms: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          step_id: string;
          marker_id?: string | null;
          type: 'text' | 'arrow' | 'rectangle' | 'circle' | 'underline';
          style?: Json;
          geometry?: Json;
          show_duration_ms?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_annotations']['Insert']>;
      };
      mm_audio_assets: {
        Row: {
          id: string;
          step_id: string;
          audio_url: string;
          duration_ms: number;
          script_text: string;
          voice: 'nova' | 'alloy';
          created_at: string;
        };
        Insert: {
          id?: string;
          step_id: string;
          audio_url: string;
          duration_ms?: number;
          script_text: string;
          voice?: 'nova' | 'alloy';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_audio_assets']['Insert']>;
      };
      mm_view_events: {
        Row: {
          id: string;
          tutorial_id: string;
          viewer_session_id: string;
          step_number: number | null;
          event_type: 'enter' | 'step' | 'complete' | 'exit';
          timestamp: string;
        };
        Insert: {
          id?: string;
          tutorial_id: string;
          viewer_session_id: string;
          step_number?: number | null;
          event_type: 'enter' | 'step' | 'complete' | 'exit';
          timestamp?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_view_events']['Insert']>;
      };
      mm_survey_responses: {
        Row: {
          id: string;
          tutorial_id: string;
          viewer_session_id: string;
          q1_easier_than_pdf: number;
          q2_would_use_again: number;
          q3_useful_for_work: number;
          q4_can_reproduce: boolean;
          q5_additional_feedback: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tutorial_id: string;
          viewer_session_id: string;
          q1_easier_than_pdf: number;
          q2_would_use_again: number;
          q3_useful_for_work: number;
          q4_can_reproduce: boolean;
          q5_additional_feedback?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_survey_responses']['Insert']>;
      };
      mm_pro_signups: {
        Row: {
          id: string;
          user_id: string | null;
          email: string;
          plan_interested: 'pro' | 'team';
          source: 'landing' | 'editor' | 'limit_modal' | 'mypage';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          email: string;
          plan_interested: 'pro' | 'team';
          source: 'landing' | 'editor' | 'limit_modal' | 'mypage';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_pro_signups']['Insert']>;
      };
      mm_capture_sessions: {
        Row: {
          id: string;
          user_id: string;
          status: 'active' | 'done' | 'cancelled';
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: 'active' | 'done' | 'cancelled';
          started_at?: string;
          ended_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['mm_capture_sessions']['Insert']>;
      };
      mm_capture_events: {
        Row: {
          id: string;
          session_id: string;
          screenshot_url: string;
          click_x: number;
          click_y: number;
          url: string;
          element_text: string | null;
          ai_title: string | null;
          ai_description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          screenshot_url: string;
          click_x: number;
          click_y: number;
          url: string;
          element_text?: string | null;
          ai_title?: string | null;
          ai_description?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mm_capture_events']['Insert']>;
      };
    };
  };
}

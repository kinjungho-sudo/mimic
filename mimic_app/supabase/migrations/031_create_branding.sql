-- mm_branding — PPTX 내보내기용 회사 브랜딩 설정 (사용자당 1행)
CREATE TABLE IF NOT EXISTS mm_branding (
  user_id       uuid PRIMARY KEY REFERENCES mm_users(id) ON DELETE CASCADE,
  logo_url      text,
  primary_color text NOT NULL DEFAULT '#4F46E5' CHECK (primary_color ~* '^#[0-9a-f]{6}$'),
  company_name  text,
  footer_text   text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS: 정책 없음 → anon/authenticated 직접 접근 차단. 읽기/쓰기는 service role(API)만.
ALTER TABLE mm_branding ENABLE ROW LEVEL SECURITY;

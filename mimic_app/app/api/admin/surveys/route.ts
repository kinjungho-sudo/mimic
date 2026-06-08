import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('mm_survey_responses')
    .select('id, tutorial_id, viewer_session_id, q1_easier_than_pdf, q2_would_use_again, q3_useful_for_work, q4_can_reproduce, q5_additional_feedback, created_at, mm_tutorials(title)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ surveys: data });
}

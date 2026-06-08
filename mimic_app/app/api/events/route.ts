import { NextRequest, NextResponse } from 'next/server';
import { eventsSchema } from '@/lib/validators';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = eventsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  await supabase.from('mm_view_events').insert({
    tutorial_id: parsed.data.tutorial_id,
    viewer_session_id: parsed.data.viewer_session_id,
    event_type: parsed.data.event_type,
    step_number: parsed.data.step_number ?? null,
  });

  return new NextResponse(null, { status: 204 });
}

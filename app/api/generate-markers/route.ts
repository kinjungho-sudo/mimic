import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { generateMarkersSchema } from '@/lib/validators';
import { generateMarkers } from '@/lib/claude';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { rateLimitAi } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimitAi(auth.userId);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = generateMarkersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const markers = await generateMarkers(parsed.data.steps);

    // DB에 저장
    if (markers.length > 0) {
      const supabase = createServiceRoleClient();
      await supabase.from('mm_markers').insert(
        markers.map((m: Record<string, unknown>) => ({ ...m, ai_generated: true }))
      );
    }

    return NextResponse.json({ markers });
  } catch (err) {
    console.error('generate-markers error:', err);
    return NextResponse.json({ error: 'Marker generation failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logServer } from '@/lib/logging/logger-server';

const BUCKET = 'naviaction';
const PATH_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(step_\d{2,3}\.jpg|voice(?:_step_\d{2,3})?\.webm)$/i;
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'audio/webm']);

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const path = typeof body?.path === 'string' ? body.path : '';
  const contentType = typeof body?.content_type === 'string' ? body.content_type : '';
  const match = PATH_PATTERN.exec(path);

  if (!match || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Invalid upload target' }, { status: 400 });
  }

  const sessionId = match[1];
  const supabase = createServiceRoleClient();
  const { data: existingSession, error: sessionLookupError } = await supabase
    .from('mm_capture_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionLookupError) {
    await logServer('error', 'capture.uploadTarget.sessionLookupFail', {
      sessionId,
      message: sessionLookupError.message,
    });
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 });
  }

  if (existingSession && existingSession.user_id !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!existingSession) {
    const { error: createSessionError } = await supabase
      .from('mm_capture_sessions')
      .insert({ id: sessionId, user_id: auth.userId, status: 'active' });

    if (createSessionError?.code === '23505') {
      const { data: racedSession } = await supabase
        .from('mm_capture_sessions')
        .select('user_id')
        .eq('id', sessionId)
        .maybeSingle();
      if (racedSession?.user_id !== auth.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (createSessionError) {
      await logServer('error', 'capture.uploadTarget.sessionCreateFail', {
        sessionId,
        message: createSessionError.message,
      });
      return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 });
    }
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data?.signedUrl) {
    await logServer('error', 'capture.uploadTarget.signFail', {
      sessionId,
      message: error?.message ?? 'missing signed URL',
    });
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 });
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    signed_url: data.signedUrl,
    public_url: publicData.publicUrl,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { guardStepAccess } from '@/lib/workspace-guard';

const stepPatchSchema = z.object({
  user_title: z.string().max(200).nullable().optional(),
  user_script: z.string().max(2000).nullable().optional(),
  user_annotations: z.array(z.unknown()).nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = stepPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // 워크스페이스 역할 체크 (개인이면 소유자, 워크스페이스면 editor 이상)
  const guard = await guardStepAccess(id, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('mm_steps')
    .update(parsed.data)
    .eq('id', id)
    .select('id, user_title, user_script, user_annotations')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // 스텝 삭제는 editor 이상 허용
  const guard = await guardStepAccess(id, auth.userId, 'editor');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('mm_steps').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}

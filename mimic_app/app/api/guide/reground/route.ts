import { NextRequest, NextResponse } from 'next/server';
import { requireExtensionToken } from '@/lib/auth-guard';
import { guideRegroundSchema } from '@/lib/validators';
import { regroundElement } from '@/lib/claude';
import { rateLimitAi } from '@/lib/rate-limit';

// POST /api/guide/reground — 라이브 가이드 AI 시각 재탐색
// 셀렉터·XPath·퍼지가 모두 실패했을 때, 현재 화면 스크린샷에서 대상 요소 위치를 복구한다.
export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimitAi(auth.userId);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = guideRegroundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { image, mediaType, title, instruction, elementText, actionType } = parsed.data;
    const result = await regroundElement(image, mediaType, {
      title:       title       ?? undefined,
      instruction: instruction ?? undefined,
      elementText: elementText ?? undefined,
      actionType:  actionType  ?? undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('guide reground error:', err);
    return NextResponse.json({ error: 'Reground failed' }, { status: 500 });
  }
}

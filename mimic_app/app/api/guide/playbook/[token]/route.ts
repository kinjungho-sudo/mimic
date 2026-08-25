import { NextRequest, NextResponse } from 'next/server';
import { resolvePublishedPlaybookLiveGuide } from '@/lib/live-guide/playbook-server';

type Params = { params: Promise<{ token: string }> };

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
};

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: RESPONSE_HEADERS });
}

// 게시된 플레이북의 가이드 블록을 문서 순서대로 펼쳐 하나의 Live Guide로 반환한다.
// 같은 매뉴얼이 여러 번 배치된 경우도 해당 위치마다 다시 포함한다.
export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  const result = await resolvePublishedPlaybookLiveGuide(token);
  return json(result.payload, result.status);
}

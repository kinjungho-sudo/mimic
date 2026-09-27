import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '@/lib/auth/auth-guard';
import { logAudit } from '@/lib/logging/logger-server';

const allowedRoots = [
  '/home', '/dashboard', '/manual', '/workspace', '/mypage',
  '/settings', '/trash', '/pages', '/extension-link',
  '/download', '/desktop-setup', '/admin',
];
const bodySchema = z.object({ path: z.string().min(1).max(300) });

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });

  const path = parsed.data.path;
  if (!allowedRoots.some(root => path === root || path.startsWith(`${root}/`))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  if (path === '/admin' || path.startsWith('/admin/')) {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
  }

  await logAudit('user.access', { userId: auth.userId, url: path });
  return new NextResponse(null, { status: 204 });
}

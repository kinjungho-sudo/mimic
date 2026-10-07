import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

// Proof that a viewer already passed a manual's share password.
// Issued by POST /api/play/[token]; required by every other route that serves
// the same protected manual (Live Guide, PDF export). Binding the stored
// password hash means changing the password revokes earlier proofs.

export const SHARE_ACCESS_HEADER = 'x-parro-share-access';
export const SHARE_ACCESS_TTL_MS = 12 * 60 * 60 * 1000;

function signingKey(): string {
  const key = process.env.SHARE_ACCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('share access signing key is not configured');
  return key;
}

function sign(tutorialId: string, passwordHash: string, expiresAt: number): string {
  return createHmac('sha256', signingKey())
    .update(`parro-share-access:v1:${tutorialId}:${passwordHash}:${expiresAt}`)
    .digest('base64url');
}

export function createShareAccessProof(tutorialId: string, passwordHash: string, now = Date.now()): string {
  const expiresAt = now + SHARE_ACCESS_TTL_MS;
  return `${expiresAt}.${sign(tutorialId, passwordHash, expiresAt)}`;
}

export function verifyShareAccessProof(
  proof: string | null | undefined,
  tutorialId: string,
  passwordHash: string,
  now = Date.now(),
): boolean {
  if (!proof) return false;
  const [expiresRaw, signature] = proof.split('.');
  const expiresAt = Number(expiresRaw);
  if (!signature || !Number.isFinite(expiresAt) || expiresAt < now) return false;
  const expected = Buffer.from(sign(tutorialId, passwordHash, expiresAt));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** True when the manual has no share password or the request carries a valid proof. */
export function hasShareAccess(
  request: NextRequest,
  tutorial: { id: string; share_password: string | null },
): boolean {
  if (!tutorial.share_password) return true;
  const proof = request.headers.get(SHARE_ACCESS_HEADER) ?? request.nextUrl.searchParams.get('access');
  return verifyShareAccessProof(proof, tutorial.id, tutorial.share_password);
}

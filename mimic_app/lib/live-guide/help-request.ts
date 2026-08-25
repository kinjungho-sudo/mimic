import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const MARKER = 'parro-live-guide-help:';
const MARKER_PATTERN = /\n\n<!--parro-live-guide-help:([A-Za-z0-9_-]+)-->\s*$/;

export interface LiveGuideHelpMetadata {
  v: 1;
  path: string | null;
  key: string | null;
  iv: string | null;
  tag: string | null;
  mime: 'image/png' | 'image/jpeg' | null;
  page_url: string | null;
  step_number: number | null;
}

export function encryptHelpScreenshot(buffer: Buffer) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return {
    encrypted,
    key: key.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  };
}

export function decryptHelpScreenshot(buffer: Buffer, metadata: LiveGuideHelpMetadata) {
  if (!metadata.key || !metadata.iv || !metadata.tag) throw new Error('Missing encryption metadata');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(metadata.key, 'base64url'),
    Buffer.from(metadata.iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(metadata.tag, 'base64url'));
  return Buffer.concat([decipher.update(buffer), decipher.final()]);
}

export function encodeHelpRequestBody(text: string, metadata: LiveGuideHelpMetadata) {
  const encoded = Buffer.from(JSON.stringify(metadata), 'utf8').toString('base64url');
  return `${text.trim()}\n\n<!--${MARKER}${encoded}-->`;
}

export function parseHelpRequestBody(body: string, tutorialId?: string) {
  const match = MARKER_PATTERN.exec(body);
  if (!match) return null;
  try {
    const metadata = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')) as LiveGuideHelpMetadata;
    if (metadata.v !== 1) return null;
    if (metadata.path && tutorialId && !metadata.path.startsWith(`live-guide-help/${tutorialId}/`)) return null;
    return { text: body.slice(0, match.index).trim(), metadata };
  } catch {
    return null;
  }
}

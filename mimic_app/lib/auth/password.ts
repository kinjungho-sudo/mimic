import { scrypt, timingSafeEqual, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/** "$salt:hash" 형태로 비밀번호 해싱 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(plain, salt, 32)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

/** 저장된 해시와 평문 비밀번호 비교 (타이밍 공격 방지) */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // 하위 호환: 해시 형식이 아니면(구버전 평문) 직접 비교
  if (!stored.includes(':')) return plain === stored;
  const [salt, storedHash] = stored.split(':');
  const hash = (await scryptAsync(plain, salt, 32)) as Buffer;
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (hash.length !== storedBuf.length) return false;
  return timingSafeEqual(hash, storedBuf);
}

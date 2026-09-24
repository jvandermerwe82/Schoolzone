/** Password/PIN hashing and session tokens, using Node's built-in crypto. */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type BinaryLike } from 'node:crypto';

const scrypt = (password: BinaryLike, salt: BinaryLike, keylen: number) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key))));

const KEY_LENGTH = 64;

/** Salted scrypt hash, stored as "scrypt$<salt>$<hash>". */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(secret, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(secret, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(key, expected);
}

export const newId = () => randomBytes(12).toString('base64url');
export const newToken = () => randomBytes(32).toString('base64url');
/** Only a hash of each session token is stored, so a leaked database can't be used to log in. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Simple fixed-window rate limiter, kept in memory (fine for a single server). */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private limit: number, private windowMs: number) {}

  /** Returns true if the action is allowed. */
  take(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || h.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (h.count >= this.limit) return false;
    h.count++;
    return true;
  }
}

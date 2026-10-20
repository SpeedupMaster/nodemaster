import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function deriveRealityPublicKey(privateKey: string): string {
  const raw = Buffer.from(privateKey, 'base64url');
  if (raw.length !== 32) throw new Error('Invalid X25519 private key');
  const key = crypto.createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b656e04220420', 'hex'), raw]), format: 'der', type: 'pkcs8' });
  return crypto.createPublicKey(key).export({ format: 'jwk' }).x!;
}

export function newRealityKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519');
  return { privateKey: privateKey.export({ format: 'jwk' }).d!, publicKey: publicKey.export({ format: 'jwk' }).x! };
}

const PBKDF2 = { iterations: 100000, keyLength: 64, digest: 'sha512' } as const;

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2.iterations, PBKDF2.keyLength, PBKDF2.digest).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const a = Buffer.from(hashPassword(password, salt).hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Collision-free identifier with a readable prefix, e.g. `relay-1b9d6bcd…`. */
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function atomicWriteJson(file: string, data: unknown, backup = false): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp.${crypto.randomUUID()}`;
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(data)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (backup && fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

/** Start of the billing period containing `now`; a reset day past the month's end falls on its last day. */
export function billingPeriod(now: number, resetDay: number): number {
  const date = new Date(now);
  const boundary = (year: number, month: number) => {
    const day = Math.min(Math.max(1, resetDay), new Date(year, month + 1, 0).getDate());
    return new Date(year, month, day).getTime();
  };
  const current = boundary(date.getFullYear(), date.getMonth());
  return now >= current ? current : boundary(date.getFullYear(), date.getMonth() - 1);
}

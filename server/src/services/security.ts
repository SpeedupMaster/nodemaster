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

export function billingPeriod(now: number, resetDay: number): number {
  const date = new Date(now);
  const boundary = (year: number, month: number) => {
    const day = Math.min(Math.max(1, resetDay), new Date(year, month + 1, 0).getDate());
    return new Date(year, month, day).getTime();
  };
  const current = boundary(date.getFullYear(), date.getMonth());
  return now >= current ? current : boundary(date.getFullYear(), date.getMonth() - 1);
}

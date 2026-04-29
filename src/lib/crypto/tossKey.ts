/**
 * 토스페이먼츠 Secret Key AES-256-GCM 암호화/복호화
 *
 * 환경변수 TOSS_KEY_ENC_SECRET (32바이트 이상 임의 문자열)으로
 * 마스터 키를 SHA-256 해시해 항상 32바이트로 정규화한 뒤 사용합니다.
 *
 * 저장 형식: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * DB 유출 단독으로는 복호화 불가 (마스터 키가 환경변수에 분리 보관되므로)
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LEN    = 12; // GCM 권장 96-bit IV
const TAG_LEN   = 16;

function getMasterKey(): Buffer {
  const secret = process.env.TOSS_KEY_ENC_SECRET;
  if (!secret) throw new Error('TOSS_KEY_ENC_SECRET 환경변수가 설정되지 않았습니다.');
  // SHA-256으로 항상 32바이트 키 생성
  return createHash('sha256').update(secret).digest();
}

/** plaintext → 암호화된 문자열 */
export function encryptTossKey(plaintext: string): string {
  const key = getMasterKey();
  const iv  = randomBytes(IV_LEN);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/** 암호화된 문자열 → plaintext */
export function decryptTossKey(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('잘못된 암호화 형식입니다.');

  const [ivHex, tagHex, ctHex] = parts;
  const key      = getMasterKey();
  const iv       = Buffer.from(ivHex, 'hex');
  const authTag  = Buffer.from(tagHex, 'hex');
  const ct       = Buffer.from(ctHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** 등록된 secret key를 마스킹해 화면에 표시 (예: live_sk_****1234) */
export function maskTossKey(plaintext: string): string {
  if (plaintext.length <= 8) return '****';
  const prefix = plaintext.slice(0, plaintext.indexOf('_', plaintext.indexOf('_') + 1) + 1); // "live_sk_" or "test_sk_"
  const last4  = plaintext.slice(-4);
  return `${prefix}****${last4}`;
}

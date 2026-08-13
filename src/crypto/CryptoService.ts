import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'node:crypto';
import { DbUtilityError } from '../errors/DbUtilityError';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const KDF_SALT = 'db-utility::crypto::v1::salt';
const KDF_COST = 2 ** 14;

export interface EncryptOptions {
  key?: string;
}

export class CryptoService {
  private static getKey(customKey?: string): Buffer {
    const rawKey = customKey || this.getKeyFromEnv();
    if (!rawKey) {
      throw new DbUtilityError(
        'CRYPTO_KEY_REQUIRED',
        'Set DBUTILITY_ENCRYPTION_KEY or DB_UTILITY_ENCRYPTION_KEY in environment variables.',
      );
    }

    return scryptSync(rawKey, KDF_SALT, KEY_LENGTH, { N: KDF_COST, r: 8, p: 1 });
  }

  private static getKeyFromEnv(): string | undefined {
    return (
      process.env.DBUTILITY_ENCRYPTION_KEY ||
      process.env.DB_UTILITY_ENCRYPTION_KEY ||
      process.env.DBUTILITY_CRYPTO_KEY ||
      process.env.DB_UTILITY_CRYPTO_KEY
    );
  }

  static encrypt(plaintext: string, options?: EncryptOptions): string {
    if (plaintext === null || plaintext === undefined) {
      throw new DbUtilityError('CRYPTO_INVALID_INPUT', 'Cannot encrypt null/undefined value.');
    }

    const key = this.getKey(options?.key);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const combined = Buffer.concat([iv, authTag, ciphertext]);
    return combined.toString('base64url');
  }

  static decrypt(ciphertext: string, options?: EncryptOptions): string {
    if (ciphertext === null || ciphertext === undefined) {
      throw new DbUtilityError('CRYPTO_INVALID_INPUT', 'Cannot decrypt null/undefined value.');
    }

    if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
      throw new DbUtilityError(
        'CRYPTO_INVALID_INPUT',
        'Encrypted value must be a non-empty string.',
      );
    }

    const key = this.getKey(options?.key);

    let combined: Buffer;
    try {
      combined = Buffer.from(ciphertext, 'base64url');
    } catch {
      throw new DbUtilityError(
        'CRYPTO_DECRYPT_FAILED',
        'Encrypted value is not a valid base64url encoded string.',
      );
    }

    const minLength = IV_LENGTH + AUTH_TAG_LENGTH;
    if (combined.length < minLength) {
      throw new DbUtilityError(
        'CRYPTO_DECRYPT_FAILED',
        'Encrypted value is too short or corrupted.',
      );
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const data = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
      return plaintext.toString('utf8');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unknown error';
      throw new DbUtilityError(
        'CRYPTO_DECRYPT_FAILED',
        `Failed to decrypt value (wrong key, corrupted data or authentication tag mismatch). Details: ${message}`,
      );
    }
  }

  static isEncryptedFormat(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    if (value.length < 32) return false;
    const base64urlRegex = /^[A-Za-z0-9_-]{32,}$/;
    if (!base64urlRegex.test(value)) return false;
    try {
      const buf = Buffer.from(value, 'base64url');
      return buf.length >= IV_LENGTH + AUTH_TAG_LENGTH;
    } catch {
      return false;
    }
  }
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CryptoService } from '../../../src/crypto/CryptoService';
import { DbUtilityError } from '../../../src/errors/DbUtilityError';

describe('CryptoService', () => {
  const originalEnv = process.env;
  const TEST_KEY = 'my-super-secret-test-encryption-key';

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('encrypt', () => {
    it('deve lançar erro quando a chave não está definida', () => {
      delete process.env.DBUTILITY_ENCRYPTION_KEY;
      delete process.env.DB_UTILITY_ENCRYPTION_KEY;

      expect(() => CryptoService.encrypt('value')).toThrow(
        new DbUtilityError(
          'CRYPTO_KEY_REQUIRED',
          'Set DBUTILITY_ENCRYPTION_KEY or DB_UTILITY_ENCRYPTION_KEY in environment variables.',
        ),
      );
    });

    it('deve encriptar um texto simples com chave via variável DBUTILITY_ENCRYPTION_KEY', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = TEST_KEY;

      const result = CryptoService.encrypt('my-db-password');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(32);
      // base64url characters only
      expect(result).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('deve encriptar um texto simples com chave via variável DB_UTILITY_ENCRYPTION_KEY', () => {
      process.env.DB_UTILITY_ENCRYPTION_KEY = TEST_KEY;

      const result = CryptoService.encrypt('localhost');

      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    });

    it('deve encriptar uma string vazia sem erros', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = TEST_KEY;

      const result = CryptoService.encrypt('');

      expect(typeof result).toBe('string');
      // Can still decrypt the empty string
      expect(CryptoService.decrypt(result)).toBe('');
    });

    it('deve produzir saídas diferentes para encriptações distintas do mesmo valor', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = TEST_KEY;
      const plaintext = 'same-value';

      const a = CryptoService.encrypt(plaintext);
      const b = CryptoService.encrypt(plaintext);

      expect(a).not.toBe(b);
    });

    it('deve aceitar chave customizada via options.key sobrescrevendo env', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = 'wrong-key-in-env';
      const cipher = CryptoService.encrypt('secret', { key: 'custom-key-123' });
      const back = CryptoService.decrypt(cipher, { key: 'custom-key-123' });
      expect(back).toBe('secret');
    });

    it('deve lançar erro ao encriptar null ou undefined', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = TEST_KEY;
      // @ts-expect-error - testing runtime behavior
      expect(() => CryptoService.encrypt(null)).toThrow(DbUtilityError);
      // @ts-expect-error - testing runtime behavior
      expect(() => CryptoService.encrypt(undefined)).toThrow(DbUtilityError);
    });
  });

  describe('decrypt', () => {
    it('deve descriptografar um valor criptografado retornando o texto original', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = TEST_KEY;
      const plain = 'host=mssql.prod.example.com';
      const cipher = CryptoService.encrypt(plain);

      const result = CryptoService.decrypt(cipher);

      expect(result).toBe(plain);
    });

    it('deve descriptografar números e textos com caracteres especiais', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = TEST_KEY;
      const cases = [
        '1433',
        'p@$$w0rd!#$%^&*()',
        'usuário-com-acentoção',
        '127.0.0.1',
        'my_database_123',
      ];

      for (const c of cases) {
        const cipher = CryptoService.encrypt(c);
        expect(CryptoService.decrypt(cipher)).toBe(c);
      }
    });

    it('deve lançar erro ao descriptografar com chave diferente', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = TEST_KEY;
      const cipher = CryptoService.encrypt('hello');
      process.env.DBUTILITY_ENCRYPTION_KEY = 'another-key';

      expect(() => CryptoService.decrypt(cipher)).toThrow(DbUtilityError);
    });

    it('deve lançar erro para entrada corrompida', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = TEST_KEY;
      const cipher = CryptoService.encrypt('hello');
      const corrupted = cipher.slice(0, -4) + 'xxxx';

      expect(() => CryptoService.decrypt(corrupted)).toThrow(DbUtilityError);
    });

    it('deve lançar erro para string muito curta', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = TEST_KEY;

      expect(() => CryptoService.decrypt('abc')).toThrow(DbUtilityError);
    });

    it('deve lançar erro para string vazia', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = TEST_KEY;

      expect(() => CryptoService.decrypt('')).toThrow(DbUtilityError);
    });

    it('deve lançar CRYPTO_KEY_REQUIRED quando a chave não está definida', () => {
      delete process.env.DBUTILITY_ENCRYPTION_KEY;
      delete process.env.DB_UTILITY_ENCRYPTION_KEY;

      expect(() => CryptoService.decrypt('any-string')).toThrow(
        new DbUtilityError(
          'CRYPTO_KEY_REQUIRED',
          'Set DBUTILITY_ENCRYPTION_KEY or DB_UTILITY_ENCRYPTION_KEY in environment variables.',
        ),
      );
    });
  });

  describe('isEncryptedFormat', () => {
    beforeEach(() => {
      process.env.DBUTILITY_ENCRYPTION_KEY = TEST_KEY;
    });

    it('deve retornar true para valores encriptados válidos', () => {
      const cipher = CryptoService.encrypt('password');
      expect(CryptoService.isEncryptedFormat(cipher)).toBe(true);
    });

    it('deve retornar false para texto plano comum', () => {
      expect(CryptoService.isEncryptedFormat('localhost')).toBe(false);
      expect(CryptoService.isEncryptedFormat('root')).toBe(false);
      expect(CryptoService.isEncryptedFormat('1433')).toBe(false);
      expect(CryptoService.isEncryptedFormat('my_password_with_underscores-123')).toBe(false);
    });

    it('deve retornar false para entradas não string', () => {
      expect(CryptoService.isEncryptedFormat(123)).toBe(false);
      expect(CryptoService.isEncryptedFormat(null)).toBe(false);
      expect(CryptoService.isEncryptedFormat(undefined)).toBe(false);
      expect(CryptoService.isEncryptedFormat({})).toBe(false);
    });
  });

  describe('roundtrip com múltiplas chaves', () => {
    it('deve manter separação entre projetos usando chaves diferentes', () => {
      process.env.DBUTILITY_ENCRYPTION_KEY = 'key-A';
      const cipherA = CryptoService.encrypt('same-secret');

      process.env.DBUTILITY_ENCRYPTION_KEY = 'key-B';
      expect(() => CryptoService.decrypt(cipherA)).toThrow(DbUtilityError);
      const cipherB = CryptoService.encrypt('same-secret');

      process.env.DBUTILITY_ENCRYPTION_KEY = 'key-A';
      expect(CryptoService.decrypt(cipherA)).toBe('same-secret');

      process.env.DBUTILITY_ENCRYPTION_KEY = 'key-B';
      expect(CryptoService.decrypt(cipherB)).toBe('same-secret');
    });
  });
});

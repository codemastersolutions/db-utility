import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigLoader } from '../../../src/config/ConfigLoader';
import { CryptoService } from '../../../src/crypto/CryptoService';
import { DbUtilityError } from '../../../src/errors/DbUtilityError';
import { DatabaseConfig } from '../../../src/types/database';

vi.mock('node:fs');

describe('ConfigLoader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('deve carregar configuração das variáveis de ambiente', async () => {
    process.env.DBUTILITY_DB_TYPE = 'postgres';
    process.env.DBUTILITY_DB_HOST = 'localhost';
    process.env.DBUTILITY_DB_PORT = '5432';
    process.env.DBUTILITY_DB_USER = 'user';
    process.env.DBUTILITY_DB_PASSWORD = 'password';
    process.env.DBUTILITY_DB_NAME = 'db';

    // Simula que não existem arquivos de config padrão
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const config = await ConfigLoader.load();

    expect(config).toEqual({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'user',
      password: 'password',
      database: 'db',
      ssl: undefined,
      connectTimeoutMs: undefined,
      connectionString: undefined,
      encrypted: false,
    });
  });

  it('deve lançar erro se DB_TYPE ou connectionString não estiverem definidos em lugar nenhum', async () => {
    delete process.env.DBUTILITY_DB_TYPE;
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    await expect(ConfigLoader.load()).rejects.toThrow(
      new DbUtilityError('CONFIG_DB_TYPE_OR_CONNECTION_STRING_REQUIRED'),
    );
  });

  it('deve respeitar a prioridade: Override > File > Env', async () => {
    // 1. Env (Menor prioridade)
    process.env.DBUTILITY_DB_TYPE = 'postgres';
    process.env.DBUTILITY_DB_HOST = 'env-host';
    process.env.DBUTILITY_DB_USER = 'env-user';
    process.env.DBUTILITY_DB_PASSWORD = 'env-token';

    // 2. File (Média prioridade)
    const fileConfig = {
      connection: {
        host: 'file-host',
        username: 'file-user',
        // password não definido no arquivo, deve pegar do env
      },
    };
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(fileConfig));
    // Simula que encontrou dbutility.config.json
    vi.mocked(fs.existsSync).mockImplementation((path) =>
      String(path).endsWith('dbutility.config.json'),
    );

    // 3. Override (Maior prioridade)
    const overrides: Partial<DatabaseConfig> = {
      username: 'override-user',
      // host não definido no override, deve pegar do file
      // password não definido no override nem file, deve pegar do env
    };

    const config = await ConfigLoader.load(undefined, overrides);

    expect(config).toMatchObject({
      type: 'postgres', // Do Env (único lugar)
      host: 'file-host', // File ganha do Env
      username: 'override-user', // Override ganha de todos
    });
    expect(config.password).toBe(process.env.DBUTILITY_DB_PASSWORD);
  });

  it('deve carregar connectTimeoutMs do env', async () => {
    process.env.DBUTILITY_DB_TYPE = 'postgres';
    process.env.DBUTILITY_DB_CONNECT_TIMEOUT_MS = '15000';
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const config = await ConfigLoader.load();

    expect(config.connectTimeoutMs).toBe(15000);
  });

  it('deve respeitar a prioridade de connectTimeoutMs: Override > File > Env', async () => {
    process.env.DBUTILITY_DB_TYPE = 'postgres';
    process.env.DBUTILITY_DB_CONNECT_TIMEOUT_MS = '1000';

    const fileConfig = {
      connection: {
        connectTimeoutMs: 2000,
      },
    };
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(fileConfig));
    vi.mocked(fs.existsSync).mockImplementation((path) =>
      String(path).endsWith('dbutility.config.json'),
    );

    const overrides: Partial<DatabaseConfig> = {
      connectTimeoutMs: 3000,
    };

    const config = await ConfigLoader.load(undefined, overrides);
    expect(config.connectTimeoutMs).toBe(3000);
  });

  it('deve lançar erro se connectTimeoutMs for inválido', async () => {
    process.env.DBUTILITY_DB_TYPE = 'postgres';
    process.env.DBUTILITY_DB_CONNECT_TIMEOUT_MS = 'invalid';
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    await expect(ConfigLoader.load()).rejects.toMatchObject({
      code: 'CONFIG_DB_CONNECT_TIMEOUT_INVALID',
    });
  });

  it('deve carregar configuração do arquivo no formato novo (com chave connection)', async () => {
    const fileConfig = {
      language: 'en',
      connection: {
        type: 'mysql',
        host: 'file-host',
      },
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(fileConfig));

    const config = await ConfigLoader.load('custom-config.json');

    expect(config).toMatchObject({
      type: 'mysql',
      host: 'file-host',
    });
  });

  it('deve carregar configuração do arquivo no formato antigo (flat)', async () => {
    const fileConfig = {
      type: 'mssql',
      host: 'old-file-host',
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(fileConfig));

    const config = await ConfigLoader.load('old-config.json');

    expect(config).toMatchObject({
      type: 'mssql',
      host: 'old-file-host',
    });
  });

  it('deve carregar uma conexão específica do objeto connections', async () => {
    const fileConfig = {
      connections: {
        dev: {
          type: 'postgres',
          host: 'dev-host',
        },
        prod: {
          type: 'mysql',
          host: 'prod-host',
        },
      },
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(fileConfig));

    const config = await ConfigLoader.load('config.json', undefined, 'prod');

    expect(config).toMatchObject({
      type: 'mysql',
      host: 'prod-host',
    });
  });

  it('deve lançar erro se a conexão especificada não existir', async () => {
    const fileConfig = {
      connections: {
        dev: {
          type: 'postgres',
          host: 'dev-host',
        },
      },
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(fileConfig));

    await expect(ConfigLoader.load('config.json', undefined, 'staging')).rejects.toThrow(
      new DbUtilityError('CONNECTION_CONFIG_NOT_FOUND', 'staging'),
    );
  });

  describe('crypted connection fields', () => {
    const ENCRYPTION_KEY = 'unit-test-encryption-key-123';
    const encrypt = (value: string) => CryptoService.encrypt(value, { key: ENCRYPTION_KEY });

    beforeEach(() => {
      process.env.DBUTILITY_ENCRYPTION_KEY = ENCRYPTION_KEY;
    });

    it('deve descriptografar automaticamente os campos da conexão quando encrypted: true via arquivo', async () => {
      const fileConfig = {
        connection: {
          type: 'mysql',
          host: encrypt('encrypted-host.example.com'),
          port: encrypt('3307'),
          username: encrypt('encrypted-user'),
          password: encrypt('encrypted-p4ss'),
          database: encrypt('encrypted_db'),
          ssl: false,
          encrypted: true,
        },
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(fileConfig));

      const config = await ConfigLoader.load('custom-config.json');

      expect(config.encrypted).toBe(true);
      expect(config.host).toBe('encrypted-host.example.com');
      expect(config.port).toBe(3307);
      expect(config.username).toBe('encrypted-user');
      expect(config.password).toBe('encrypted-p4ss');
      expect(config.database).toBe('encrypted_db');
    });

    it('deve descriptografar campos via variáveis de ambiente quando encrypted=true', async () => {
      delete process.env.DBUTILITY_DB_HOST;
      process.env.DBUTILITY_DB_TYPE = 'mssql';
      process.env.DBUTILITY_DB_HOST = encrypt('mssql-host.example');
      process.env.DBUTILITY_DB_PORT = encrypt('1433');
      process.env.DBUTILITY_DB_USER = encrypt('sa');
      process.env.DBUTILITY_DB_PASSWORD = encrypt('Str0ng!Pass');
      process.env.DBUTILITY_DB_NAME = encrypt('master_db');
      process.env.DBUTILITY_DB_ENCRYPTED = 'true';

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const config = await ConfigLoader.load();

      expect(config.encrypted).toBe(true);
      expect(config.type).toBe('mssql');
      expect(config.host).toBe('mssql-host.example');
      expect(config.port).toBe(1433);
      expect(config.username).toBe('sa');
      expect(config.password).toBe('Str0ng!Pass');
      expect(config.database).toBe('master_db');
    });

    it('deve respeitar a precedência overrides > arquivo > env para o campo encrypted', async () => {
      // Env sem criptografia
      process.env.DBUTILITY_DB_TYPE = 'postgres';
      process.env.DBUTILITY_DB_HOST = 'env-plain-host';
      process.env.DBUTILITY_DB_USER = 'env-plain-user';

      // Arquivo com criptografia (port)
      process.env.DBUTILITY_ENCRYPTION_KEY = ENCRYPTION_KEY;
      const fileConfig = {
        connection: {
          host: 'file-plain-host',
          port: encrypt('5433'),
          encrypted: true,
        },
      };
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(fileConfig));

      // Overrides desativa criptografia e força valores plain
      const overrides: Partial<DatabaseConfig> = {
        encrypted: false,
        port: 9999,
      };

      const config = await ConfigLoader.load(undefined, overrides);

      // Desativado via override; port numérico NÃO é descriptografado e fica 9999
      expect(config.encrypted).toBe(false);
      expect(config.port).toBe(9999);
      // host e username vem de arquivo/env e ficam plain (sem descriptografia)
      expect(config.host).toBe('file-plain-host');
      expect(config.username).toBe('env-plain-user');
    });

    it('deve lançar erro ao descriptografar quando a chave de criptografia não for definida', async () => {
      delete process.env.DBUTILITY_ENCRYPTION_KEY;
      delete process.env.DB_UTILITY_ENCRYPTION_KEY;
      // Gera o valor criptografado com a chave do describe, apaga env e tenta carregar
      const encryptedHost = encrypt('host-xpto');

      process.env.DBUTILITY_DB_TYPE = 'postgres';
      // Override direto força encrypted sem chave
      const fileConfig = {
        connection: {
          host: encryptedHost,
          encrypted: true,
        },
      };
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(fileConfig));

      // Remove a chave para simular ambiente sem chave
      delete process.env.DBUTILITY_ENCRYPTION_KEY;

      await expect(ConfigLoader.load('config.json')).rejects.toMatchObject({
        code: 'CRYPTO_KEY_REQUIRED',
      });
    });

    it('deve carregar sem descriptografia quando encrypted for false ou ausente', async () => {
      process.env.DBUTILITY_DB_TYPE = 'postgres';
      process.env.DBUTILITY_DB_HOST = 'plain-host';
      process.env.DBUTILITY_DB_PORT = '5432';

      const fileConfig = {
        connection: {
          encrypted: false,
          username: 'plain-user',
        },
      };
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(fileConfig));

      const config = await ConfigLoader.load('c.json');

      expect(config.encrypted).toBe(false);
      expect(config.host).toBe('plain-host');
      expect(config.port).toBe(5432);
      expect(config.username).toBe('plain-user');
    });

    it('deve aplicar criptografia em conexões nomeadas (connections map)', async () => {
      const fileConfig = {
        connections: {
          enc: {
            type: 'postgres',
            host: encrypt('enc-db.internal'),
            port: encrypt('5432'),
            username: encrypt('enc-user'),
            password: encrypt('enc-pass'),
            database: encrypt('enc-db'),
            encrypted: true,
          },
        },
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(fileConfig));

      const config = await ConfigLoader.load('config.json', undefined, 'enc');

      expect(config.encrypted).toBe(true);
      expect(config.host).toBe('enc-db.internal');
      expect(config.port).toBe(5432);
      expect(config.username).toBe('enc-user');
      expect(config.password).toBe('enc-pass');
      expect(config.database).toBe('enc-db');
    });
  });
});

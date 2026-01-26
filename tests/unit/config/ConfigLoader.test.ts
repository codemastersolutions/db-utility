import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigLoader } from '../../../src/config/ConfigLoader';
import { DbUtilityError } from '../../../src/errors/DbUtilityError';

vi.mock('fs');

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
      connectionString: undefined,
    });
  });

  it('deve lançar erro se DB_TYPE não estiver definido no ambiente e nenhum arquivo existir', async () => {
    delete process.env.DBUTILITY_DB_TYPE;
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    try {
      await ConfigLoader.load();
    } catch (error) {
      expect(error).toBeInstanceOf(DbUtilityError);
      expect((error as DbUtilityError).code).toBe('CONFIG_DB_TYPE_REQUIRED');
    }
  });
});

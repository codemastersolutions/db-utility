import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigLoader } from '../../../src/config/ConfigLoader';
import { DbUtilityError } from '../../../src/errors/DbUtilityError';
import { DatabaseConfig } from '../../../src/types/database';

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
      ssl: undefined,
      connectionString: undefined,
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
    process.env.DBUTILITY_DB_PASSWORD = 'env-password';

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
      password: 'env-password', // Env (único lugar)
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
});

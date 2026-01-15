import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigLoader } from '../../../src/config/ConfigLoader';

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
    process.env.DB_TYPE = 'postgres';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_USER = 'user';
    process.env.DB_PASSWORD = 'password';
    process.env.DB_NAME = 'db';

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
    delete process.env.DB_TYPE;
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    await expect(ConfigLoader.load()).rejects.toThrow(
      'Configuração de banco de dados não encontrada',
    );
  });
});

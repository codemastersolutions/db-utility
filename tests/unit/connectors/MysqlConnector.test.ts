import { createPool } from 'mysql2/promise';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MysqlConnector } from '../../../src/database/connectors/MysqlConnector';
import { DatabaseConfig } from '../../../src/types/database';

vi.mock('mysql2/promise', () => {
  const connection = { release: vi.fn() };
  const pool = {
    getConnection: vi.fn(async () => connection),
    execute: vi.fn(),
    end: vi.fn(),
  };

  return {
    createPool: vi.fn(() => pool),
  };
});

describe('MysqlConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve aplicar connectTimeout quando usa host/port', async () => {
    const config: DatabaseConfig = {
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'password',
      database: 'test_db',
      connectTimeoutMs: 15000,
    };

    const connector = new MysqlConnector(config);
    await connector.connect();

    expect(createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        connectTimeout: 15000,
      }),
    );
  });

  it('deve aplicar connectTimeout quando usa connectionString', async () => {
    const config: DatabaseConfig = {
      type: 'mysql',
      connectionString: 'mysql://user:pass@localhost:3306/test_db',
      connectTimeoutMs: 15000,
    };

    const connector = new MysqlConnector(config);
    await connector.connect();

    expect(createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'mysql://user:pass@localhost:3306/test_db',
        connectTimeout: 15000,
      }),
    );
  });
});


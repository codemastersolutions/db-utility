import { ConnectionPool } from 'mssql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MssqlConnector } from '../../../src/database/connectors/MssqlConnector';
import { DatabaseConfig } from '../../../src/types/database';

vi.mock('mssql', () => {
  const pool = {
    connect: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    request: vi.fn(),
    connected: true,
  };

  return {
    ConnectionPool: vi.fn(function () {
      return pool;
    }),
  };
});

describe('MssqlConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve aplicar connectionTimeout quando usa config', async () => {
    const config: DatabaseConfig = {
      type: 'mssql',
      host: 'localhost',
      port: 1433,
      username: 'sa',
      password: 'password',
      database: 'test_db',
      connectTimeoutMs: 15000,
    };

    const connector = new MssqlConnector(config);
    await connector.connect();

    expect(ConnectionPool).toHaveBeenCalledWith(
      expect.objectContaining({
        server: 'localhost',
        connectionTimeout: 15000,
        requestTimeout: 15000,
      }),
    );
  });

  it('deve aplicar connectionTimeout quando usa connectionString', async () => {
    const config: DatabaseConfig = {
      type: 'mssql',
      connectionString: 'mssql://user:pass@localhost:1433/test_db',
      connectTimeoutMs: 15000,
    };

    const connector = new MssqlConnector(config);
    await connector.connect();

    expect(ConnectionPool).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 15000,
        requestTimeout: 15000,
        connectionString: 'mssql://user:pass@localhost:1433/test_db',
      }),
    );
  });

  it('deve usar ConnectionPool(uri) quando connectTimeoutMs não é informado', async () => {
    const config: DatabaseConfig = {
      type: 'mssql',
      connectionString: 'mssql://user:pass@localhost:1433/test_db',
    };

    const connector = new MssqlConnector(config);
    await connector.connect();

    expect(ConnectionPool).toHaveBeenCalledWith('mssql://user:pass@localhost:1433/test_db');
  });
});

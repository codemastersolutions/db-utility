import * as mssql from 'mssql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MssqlConnector } from '../../../src/database/connectors/MssqlConnector';
import { DatabaseConfig } from '../../../src/types/database';

vi.mock('mssql', () => {
  const request = {
    input: vi.fn(),
    query: vi.fn(async () => ({ recordset: [] })),
  };
  const pool = {
    connect: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    request: vi.fn(() => request),
    connected: true,
  };

  return {
    ConnectionPool: vi.fn(function () {
      return pool;
    }),
    MAX: Symbol.for('MAX'),
    NVarChar: vi.fn((size) => ({ type: 'NVarChar', size })),
    VarBinary: vi.fn((size) => ({ type: 'VarBinary', size })),
    __mockRequest: request,
  };
});

describe('MssqlConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockRequest = (mssql as typeof mssql & { __mockRequest: { input: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> } }).__mockRequest;
    mockRequest.input.mockClear();
    mockRequest.query.mockClear();
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

    expect(mssql.ConnectionPool).toHaveBeenCalledWith(
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

    expect(mssql.ConnectionPool).toHaveBeenCalledWith(
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

    expect(mssql.ConnectionPool).toHaveBeenCalledWith('mssql://user:pass@localhost:1433/test_db');
  });

  it('deve usar NVarChar(MAX) para strings acima de 4000 caracteres', async () => {
    const config: DatabaseConfig = {
      type: 'mssql',
      host: 'localhost',
      port: 1433,
      username: 'sa',
      password: 'password',
      database: 'test_db',
    };

    const connector = new MssqlConnector(config);
    await connector.connect();
    await connector.query('SELECT @param0 as value', ['a'.repeat(5000)], { bypassSafety: true });

    const mockRequest = (mssql as typeof mssql & { __mockRequest: { input: ReturnType<typeof vi.fn> } }).__mockRequest;
    expect(mockRequest.input).toHaveBeenCalledWith(
      'param0',
      expect.objectContaining({ type: 'NVarChar' }),
      expect.stringContaining('aaaa'),
    );
  });

  it('deve manter binding simples para strings curtas', async () => {
    const config: DatabaseConfig = {
      type: 'mssql',
      host: 'localhost',
      port: 1433,
      username: 'sa',
      password: 'password',
      database: 'test_db',
    };

    const connector = new MssqlConnector(config);
    await connector.connect();
    await connector.query('SELECT @param0 as value', ['curto'], { bypassSafety: true });

    const mockRequest = (mssql as typeof mssql & { __mockRequest: { input: ReturnType<typeof vi.fn> } }).__mockRequest;
    expect(mockRequest.input).toHaveBeenCalledWith('param0', 'curto');
  });
});

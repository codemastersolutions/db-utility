import { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgresConnector } from '../../../src/database/connectors/PostgresConnector';
import { DatabaseConfig } from '../../../src/types/database';

// Mock do pg
vi.mock('pg', () => {
  const mClient = {
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
    release: vi.fn(),
  };
  const mPool = {
    connect: vi.fn(async () => mClient),
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };

  return {
    Pool: vi.fn(function () {
      return mPool;
    }),
  };
});

describe('PostgresConnector', () => {
  let connector: PostgresConnector;
  let config: DatabaseConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'test',
      password: 'password',
      database: 'test_db',
    };
    connector = new PostgresConnector(config);
  });

  it('deve conectar com sucesso', async () => {
    await connector.connect();
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        database: 'test_db',
      }),
    );
  });

  it('deve executar query', async () => {
    await connector.connect();

    // Obtém a instância mockada do Pool
    type PoolMock = {
      mock: { results: Array<{ value: { query: ReturnType<typeof vi.fn> } }> };
    };
    const poolMock = Pool as unknown as PoolMock;
    const pool = poolMock.mock.results[0].value;
    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

    const result = await connector.query('SELECT * FROM table');
    expect(result).toEqual([{ id: 1 }]);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM table', undefined);
  });

  it('deve desconectar', async () => {
    await connector.connect();
    type PoolMock = {
      mock: { results: Array<{ value: { end: ReturnType<typeof vi.fn> } }> };
    };
    const poolMock = Pool as unknown as PoolMock;
    const pool = poolMock.mock.results[0].value;

    await connector.disconnect();
    expect(pool.end).toHaveBeenCalled();
  });
});

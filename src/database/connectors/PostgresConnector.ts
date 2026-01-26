import { Pool, PoolConfig } from 'pg';
import { DbUtilityError } from '../../errors/DbUtilityError';
import { DatabaseConfig, IDatabaseConnector, QueryOptions } from '../../types/database';
import { assertSafeSql } from '../SqlSafety';

export class PostgresConnector implements IDatabaseConnector {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
    };

    if (this.config.connectionString) {
      poolConfig.connectionString = this.config.connectionString;
    }

    this.pool = new Pool(poolConfig);

    // Testa a conexão
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query<T>(sql: string, params?: unknown[], options?: QueryOptions): Promise<T[]> {
    if (!this.pool) {
      throw new DbUtilityError('CONNECTION_FAILED');
    }

    if (!options?.bypassSafety) {
      assertSafeSql(sql);
    }

    const result = await this.pool.query(sql, params as never);
    return result.rows as T[];
  }

  async isConnected(): Promise<boolean> {
    // pg pool não tem um método direto isConnected simples sem tentar conectar ou manter estado
    // Mas se pool existe e não terminou, assumimos conectado/pronto.
    // Uma verificação real seria tentar uma query simples SELECT 1
    if (!this.pool) return false;
    try {
      const client = await this.pool.connect();
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    const result = await this.query<{ version: string }>('SELECT version()', [], {
      bypassSafety: true,
    });
    return result[0]?.version || 'Unknown Postgres Version';
  }
}

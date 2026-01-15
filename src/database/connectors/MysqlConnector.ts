import { createPool, Pool, PoolOptions } from 'mysql2/promise';
import { DatabaseConfig, IDatabaseConnector } from '../../types/database';

export class MysqlConnector implements IDatabaseConnector {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const poolOptions: PoolOptions = {
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };

    if (this.config.connectionString) {
      // mysql2 suporta connection uri
      this.pool = createPool(this.config.connectionString);
    } else {
      this.pool = createPool(poolOptions);
    }

    // Testa a conexão
    const connection = await this.pool.getConnection();
    connection.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Conexão não estabelecida');
    }

    const [rows] = await this.pool.execute(sql, params as never);
    return rows as T[];
  }

  async isConnected(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      const connection = await this.pool.getConnection();
      connection.release();
      return true;
    } catch {
      return false;
    }
  }
}

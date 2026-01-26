import { ConnectionPool, config as MssqlConfig } from 'mssql';
import { DbUtilityError } from '../../errors/DbUtilityError';
import { DatabaseConfig, IDatabaseConnector, QueryOptions } from '../../types/database';
import { assertSafeSql } from '../SqlSafety';

export class MssqlConnector implements IDatabaseConnector {
  private pool: ConnectionPool | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const mssqlConfig: MssqlConfig = {
      server: this.config.host || 'localhost',
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      options: {
        encrypt: this.config.ssl !== false, // Azure precisa de encrypt: true
        trustServerCertificate: !this.config.ssl, // Dev local geralmente precisa de true
      },
    };

    if (this.config.connectionString) {
      await this.connectWithUri(this.config.connectionString);
    } else {
      this.pool = new ConnectionPool(mssqlConfig);
      await this.pool.connect();
    }
  }

  private async connectWithUri(uri: string): Promise<void> {
    this.pool = new ConnectionPool(uri);
    await this.pool.connect();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
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

    const request = this.pool.request();

    if (params) {
      params.forEach((param, index) => {
        request.input(`param${index}`, param as never);
      });
    }

    const result = await request.query(sql);
    return result.recordset as T[];
  }

  async isConnected(): Promise<boolean> {
    if (!this.pool) return false;
    return this.pool.connected;
  }

  async getVersion(): Promise<string> {
    const result = await this.query<{ version: string }>('SELECT @@VERSION as version', [], {
      bypassSafety: true,
    });
    return result[0]?.version || 'Unknown MSSQL Version';
  }
}

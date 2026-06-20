import { ConnectionPool, MAX, NVarChar, VarBinary } from 'mssql';
import type { config as MssqlConfig } from 'mssql';
import { DbUtilityError } from '../../errors/DbUtilityError';
import { DatabaseConfig, IDatabaseConnector, QueryOptions } from '../../types/database';
import { assertSafeSql } from '../SqlSafety';

export class MssqlConnector implements IDatabaseConnector {
  private pool: ConnectionPool | null = null;
  private readonly config: DatabaseConfig;

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
      ...(this.config.connectTimeoutMs === undefined
        ? {}
        : {
            connectionTimeout: this.config.connectTimeoutMs,
            requestTimeout: this.config.connectTimeoutMs,
          }),
      options: {
        encrypt: this.config.ssl !== false, // Azure precisa de encrypt: true
        trustServerCertificate: !this.config.ssl, // Dev local geralmente precisa de true
      },
    };

    if (this.config.connectionString) {
      if (this.config.connectTimeoutMs === undefined) {
        this.pool = new ConnectionPool(this.config.connectionString);
      } else {
        const poolConfig = {
          ...(mssqlConfig as unknown as Record<string, unknown>),
          connectionString: this.config.connectionString,
        };
        this.pool = new ConnectionPool(poolConfig as unknown as MssqlConfig);
      }
    } else {
      this.pool = new ConnectionPool(mssqlConfig);
    }
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
        if (typeof param === 'string' && param.length > 4000) {
          request.input(`param${index}`, NVarChar(MAX), param);
          return;
        }

        if (param instanceof Uint8Array && param.byteLength > 8000) {
          request.input(`param${index}`, VarBinary(MAX), param as never);
          return;
        }

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

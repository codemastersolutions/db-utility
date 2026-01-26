export type DatabaseType = 'mysql' | 'postgres' | 'mssql';

export interface DatabaseConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  // Opções específicas podem ser adicionadas depois
  connectionString?: string;
}

export interface QueryOptions {
  bypassSafety?: boolean;
}

export interface IDatabaseConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T>(sql: string, params?: unknown[], options?: QueryOptions): Promise<T[]>;
  isConnected(): Promise<boolean>;
  getVersion(): Promise<string>;
}

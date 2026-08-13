export type DatabaseType = 'mysql' | 'postgres' | 'mssql';

export interface DatabaseConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  connectTimeoutMs?: number;
  // Opções específicas podem ser adicionadas depois
  connectionString?: string;
  /**
   * When true, the properties host, port, username, password and database are expected
   * to be encrypted using DbUtility's built-in AES-256-GCM encryption.
   * The library will automatically decrypt them before connecting to the database.
   * The encryption key must be provided via DBUTILITY_ENCRYPTION_KEY environment variable.
   */
  encrypted?: boolean;
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

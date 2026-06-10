import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseConfig, DatabaseType } from '../types/database';
import { DbUtilityError } from '../errors/DbUtilityError';

dotenv.config();

const localRequire = createRequire(__filename);

export class ConfigLoader {
  private static readonly MAX_CONNECT_TIMEOUT_MS = 10 * 60 * 1000;

  static async load(
    configPath?: string,
    overrides?: Partial<DatabaseConfig>,
    connectionName?: string,
  ): Promise<DatabaseConfig> {
    const envConfig = this.loadFromEnvRaw();
    const fileConfig = await this.loadFromFileConfig(configPath, connectionName);

    // 3. Mesclar: Overrides > File > Env
    const merge = <K extends keyof DatabaseConfig>(key: K): DatabaseConfig[K] => {
      const val = overrides?.[key] ?? fileConfig[key] ?? envConfig[key];
      return val as DatabaseConfig[K];
    };

    const finalConfig: DatabaseConfig = {
      type: merge('type') as DatabaseType,
      host: merge('host'),
      port: merge('port'),
      username: merge('username'),
      password: merge('password'),
      database: merge('database'),
      ssl: merge('ssl'),
      connectTimeoutMs: merge('connectTimeoutMs'),
      connectionString: merge('connectionString'),
    };

    // Validação final
    if (!finalConfig.type && !finalConfig.connectionString) {
      throw new DbUtilityError('CONFIG_DB_TYPE_OR_CONNECTION_STRING_REQUIRED');
    }

    if (finalConfig.connectTimeoutMs !== undefined) {
      finalConfig.connectTimeoutMs = this.parseConnectTimeoutMs(finalConfig.connectTimeoutMs);
    }

    return finalConfig;
  }

  private static async loadFromFileConfig(
    configPath?: string,
    connectionName?: string,
  ): Promise<Partial<DatabaseConfig>> {
    const resolvedPath = this.resolveConfigPath(configPath);
    if (!resolvedPath) return {};

    const rawFile = await this.loadFromFileRaw(resolvedPath);
    return this.selectDatabaseConfigFromFile(rawFile, connectionName);
  }

  private static resolveConfigPath(configPath?: string): string | undefined {
    if (configPath) return configPath;

    const defaultFiles = ['dbutility.config.json', 'db-utility.config.json', '.db-utilityrc'];
    for (const file of defaultFiles) {
      const candidate = resolve(process.cwd(), file);
      if (existsSync(candidate)) return candidate;
    }

    return undefined;
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private static parseOptionalInt(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
  }

  private static toDatabaseConfigPartial(source: Record<string, unknown>): Partial<DatabaseConfig> {
    return {
      type: typeof source.type === 'string' ? (source.type as DatabaseType) : undefined,
      host: typeof source.host === 'string' ? source.host : undefined,
      port: this.parseOptionalInt(source.port),
      username: typeof source.username === 'string' ? source.username : undefined,
      password: typeof source.password === 'string' ? source.password : undefined,
      database: typeof source.database === 'string' ? source.database : undefined,
      ssl: typeof source.ssl === 'boolean' ? source.ssl : undefined,
      connectionString:
        typeof source.connectionString === 'string' ? source.connectionString : undefined,
      connectTimeoutMs: this.parseOptionalInt(source.connectTimeoutMs),
    };
  }

  private static selectDatabaseConfigFromFile(
    rawFile: unknown,
    connectionName?: string,
  ): Partial<DatabaseConfig> {
    if (!this.isRecord(rawFile)) return {};

    if (connectionName) return this.selectNamedConnection(rawFile, connectionName);
    return this.selectDefaultConnection(rawFile);
  }

  private static selectNamedConnection(
    rawFile: Record<string, unknown>,
    connectionName: string,
  ): Partial<DatabaseConfig> {
    const connections = rawFile.connections;
    if (!this.isRecord(connections)) {
      throw new DbUtilityError('CONNECTION_CONFIG_NOT_FOUND', connectionName);
    }
    const selected = connections[connectionName];
    if (!this.isRecord(selected)) {
      throw new DbUtilityError('CONNECTION_CONFIG_NOT_FOUND', connectionName);
    }
    return this.toDatabaseConfigPartial(selected);
  }

  private static selectDefaultConnection(
    rawFile: Record<string, unknown>,
  ): Partial<DatabaseConfig> {
    const connection = rawFile.connection;
    if (this.isRecord(connection)) return this.toDatabaseConfigPartial(connection);
    if (rawFile.type !== undefined || rawFile.connectionString !== undefined) {
      return this.toDatabaseConfigPartial(rawFile);
    }
    return {};
  }

  private static async loadFromFileRaw(path: string): Promise<unknown> {
    const absolutePath = resolve(process.cwd(), path);
    if (!existsSync(absolutePath)) {
      throw new DbUtilityError('CONFIG_FILE_NOT_FOUND', absolutePath);
    }

    const ext = extname(absolutePath);
    if (ext === '.json' || ext === '') {
      const content = readFileSync(absolutePath, 'utf-8');
      return JSON.parse(content);
    } else if (ext === '.js') {
      const config = localRequire(absolutePath);
      return config.default || config;
    }

    throw new DbUtilityError('CONFIG_FILE_FORMAT_UNSUPPORTED', ext);
  }

  private static loadFromEnvRaw(): Partial<DatabaseConfig> {
    const dbType = process.env.DBUTILITY_DB_TYPE || process.env.DB_TYPE;

    const host = process.env.DBUTILITY_DB_HOST || process.env.DB_HOST;
    const portStr = process.env.DBUTILITY_DB_PORT || process.env.DB_PORT;
    const username =
      process.env.DBUTILITY_DB_USER ||
      process.env.DBUTILITY_DB_USERNAME ||
      process.env.DB_USER ||
      process.env.DB_USERNAME;
    const password = process.env.DBUTILITY_DB_PASSWORD || process.env.DB_PASSWORD;
    const database =
      process.env.DBUTILITY_DB_NAME ||
      process.env.DBUTILITY_DB_DATABASE ||
      process.env.DB_NAME ||
      process.env.DB_DATABASE;
    const connectionString =
      process.env.DBUTILITY_DB_CONNECTION_STRING || process.env.DB_CONNECTION_STRING;

    const connectTimeoutMsStr =
      process.env.DBUTILITY_DB_CONNECT_TIMEOUT_MS || process.env.DB_CONNECT_TIMEOUT_MS;

    return {
      type: dbType as DatabaseType,
      host,
      port: portStr ? Number.parseInt(portStr, 10) : undefined,
      username,
      password,
      database,
      connectTimeoutMs: connectTimeoutMsStr ? Number.parseInt(connectTimeoutMsStr, 10) : undefined,
      connectionString,
    };
  }

  private static safeValueForError(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || value === null)
      return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }

  private static parseConnectTimeoutMs(value: unknown): number {
    let parsed: number;
    if (typeof value === 'number') {
      parsed = value;
    } else if (typeof value === 'string') {
      parsed = Number.parseInt(value, 10);
    } else {
      parsed = Number.NaN;
    }

    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new DbUtilityError('CONFIG_DB_CONNECT_TIMEOUT_INVALID', this.safeValueForError(value));
    }

    if (parsed < 1 || parsed > this.MAX_CONNECT_TIMEOUT_MS) {
      throw new DbUtilityError('CONFIG_DB_CONNECT_TIMEOUT_INVALID', this.safeValueForError(value));
    }

    return parsed;
  }
}

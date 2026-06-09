import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { DatabaseConfig, DatabaseType } from '../types/database';
import { DbUtilityError } from '../errors/DbUtilityError';

dotenv.config();

export class ConfigLoader {
  private static readonly MAX_CONNECT_TIMEOUT_MS = 10 * 60 * 1000;

  static async load(
    configPath?: string,
    overrides?: Partial<DatabaseConfig>,
    connectionName?: string,
  ): Promise<DatabaseConfig> {
    // 1. Carregar do ENV (base)
    const envConfig = this.loadFromEnvRaw();

    // 2. Carregar do Arquivo
    let fileConfig: Partial<DatabaseConfig> = {};

    // Lista de arquivos a procurar, priorizando o novo padrão
    const defaultFiles = ['dbutility.config.json', 'db-utility.config.json', '.db-utilityrc'];

    let path = configPath;
    if (!path) {
      for (const file of defaultFiles) {
        const p = resolve(process.cwd(), file);
        if (existsSync(p)) {
          path = p;
          break;
        }
      }
    }

    if (path) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawFile: any = await this.loadFromFileRaw(path);

      // Verifica se tem a propriedade 'connection' (novo formato) ou se é o formato antigo
      if (rawFile && typeof rawFile === 'object') {
        if (connectionName) {
          if (
            rawFile.connections &&
            typeof rawFile.connections === 'object' &&
            rawFile.connections[connectionName]
          ) {
            fileConfig = rawFile.connections[connectionName];
          } else {
            throw new DbUtilityError('CONNECTION_CONFIG_NOT_FOUND', connectionName);
          }
        } else if ('connection' in rawFile && typeof rawFile.connection === 'object') {
          fileConfig = rawFile.connection;
        } else if ('type' in rawFile || 'connectionString' in rawFile) {
          // Assume formato antigo (flat) se tiver propriedades chave
          fileConfig = rawFile as Partial<DatabaseConfig>;
        }
      }
    }

    // 3. Mesclar: Overrides > File > Env
    const merge = <K extends keyof DatabaseConfig>(key: K): DatabaseConfig[K] => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const config = require(absolutePath);
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

  private static parseConnectTimeoutMs(value: unknown): number {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseInt(value, 10)
          : Number.NaN;

    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new DbUtilityError('CONFIG_DB_CONNECT_TIMEOUT_INVALID', String(value));
    }

    if (parsed < 1 || parsed > this.MAX_CONNECT_TIMEOUT_MS) {
      throw new DbUtilityError('CONFIG_DB_CONNECT_TIMEOUT_INVALID', String(value));
    }

    return parsed;
  }
}

import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { extname, resolve } from 'path';
import { DatabaseConfig, DatabaseType } from '../types/database';
import { DbUtilityError } from '../errors/DbUtilityError';

dotenv.config();

export class ConfigLoader {
  static async load(
    configPath?: string,
    overrides?: Partial<DatabaseConfig>,
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
        if ('connection' in rawFile && typeof rawFile.connection === 'object') {
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
      connectionString: merge('connectionString'),
    };

    // Validação final
    if (!finalConfig.type && !finalConfig.connectionString) {
      throw new DbUtilityError('CONFIG_DB_TYPE_OR_CONNECTION_STRING_REQUIRED');
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

    return {
      type: dbType as DatabaseType,
      host,
      port: portStr ? parseInt(portStr, 10) : undefined,
      username,
      password,
      database,
      connectionString,
    };
  }
}

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
    let config: DatabaseConfig;

    if (configPath) {
      config = await this.loadFromFile(configPath);
    } else {
      // Tenta encontrar arquivos de configuração padrão
      const defaultFiles = ['db-utility.config.js', 'db-utility.config.json', '.db-utilityrc'];
      let found = false;

      // Inicializa config temporária para evitar erro de 'used before assigned'
      // Se não encontrar arquivo, será sobrescrita pelo loadFromEnv
      config = {} as DatabaseConfig;

      for (const file of defaultFiles) {
        const path = resolve(process.cwd(), file);
        if (existsSync(path)) {
          config = await this.loadFromFile(path);
          found = true;
          break;
        }
      }

      if (!found) {
        // Se não encontrar arquivo, tenta carregar do ambiente
        // Mas apenas se não houver overrides suficientes para formar uma conexão
        // Se o usuário passou todos os parâmetros via flag, não precisamos do .env obrigatoriamente
        try {
          config = this.loadFromEnv();
        } catch (error) {
          // Se falhar ao carregar do env, verificamos se temos overrides suficientes depois
          // Por enquanto, deixamos vazio e validamos no final
          if (!overrides || Object.keys(overrides).length === 0) {
            throw error;
          }
        }
      }
    }

    // Aplica overrides
    if (overrides) {
      config = { ...config, ...overrides };
    }

    // Validação básica
    if (!config.type && !config.connectionString) {
      throw new DbUtilityError('CONFIG_DB_TYPE_OR_CONNECTION_STRING_REQUIRED');
    }

    return config;
  }

  private static async loadFromFile(path: string): Promise<DatabaseConfig> {
    const absolutePath = resolve(process.cwd(), path);
    if (!existsSync(absolutePath)) {
      throw new DbUtilityError('CONFIG_FILE_NOT_FOUND', absolutePath);
    }

    const ext = extname(absolutePath);
    if (ext === '.json' || ext === '') {
      const content = readFileSync(absolutePath, 'utf-8');
      return JSON.parse(content) as DatabaseConfig;
    } else if (ext === '.js') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const config = require(absolutePath);
      return config.default || config;
    }

    throw new DbUtilityError('CONFIG_FILE_FORMAT_UNSUPPORTED', ext);
  }

  private static loadFromEnv(): DatabaseConfig {
    const dbType = process.env.DBUTILITY_DB_TYPE || process.env.DB_TYPE;

    if (!dbType) {
      throw new DbUtilityError('CONFIG_DB_TYPE_REQUIRED');
    }

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

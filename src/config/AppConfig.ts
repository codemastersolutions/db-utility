import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { extname, resolve } from 'path';
import { DbUtilityError } from '../errors/DbUtilityError';

dotenv.config();

export type AppLanguage = 'pt-BR' | 'en' | 'es';

export interface AppConfig {
  language: AppLanguage;
  introspection: {
    outputDir: string;
  };
  migrations: {
    outputDir: string;
    fileNamePattern: 'timestamp-prefix' | 'prefix-timestamp';
  };
}

const defaultConfig: AppConfig = {
  language: 'pt-BR',
  introspection: {
    outputDir: 'db-utility-introspect',
  },
  migrations: {
    outputDir: 'db-utility-migrations',
    fileNamePattern: 'timestamp-prefix',
  },
};

export class AppConfigLoader {
  static load(configPath?: string): AppConfig {
    const fromEnv = this.loadFromEnvRaw();
    let fromFile: Partial<AppConfig> = {};

    if (configPath) {
      fromFile = this.loadFromFileRaw(configPath);
    } else {
      const defaultFiles = [
        'dbutility.config.json',
        'db-utility.app.config.json',
        '.db-utilityrc.app',
      ];

      for (const file of defaultFiles) {
        const path = resolve(process.cwd(), file);
        if (existsSync(path)) {
          fromFile = this.loadFromFileRaw(path);
          break;
        }
      }
    }

    // Merge: File > Env > Default (via normalize)
    const merged: Partial<AppConfig> = {
      language: fromFile.language || fromEnv.language,
    };

    const envIntrospection = fromEnv.introspection;
    const fileIntrospection = fromFile.introspection;
    const introspectionOutputDir = fileIntrospection?.outputDir ?? envIntrospection?.outputDir;

    if (introspectionOutputDir) {
      merged.introspection = {
        outputDir: introspectionOutputDir,
      };
    }

    const envMigrations = fromEnv.migrations;
    const fileMigrations = fromFile.migrations;

    const migrationsOutputDir = fileMigrations?.outputDir ?? envMigrations?.outputDir;
    const migrationsFileNamePatternRaw =
      fileMigrations?.fileNamePattern ?? envMigrations?.fileNamePattern;

    if (migrationsOutputDir || migrationsFileNamePatternRaw) {
      const fileNamePattern: 'timestamp-prefix' | 'prefix-timestamp' =
        migrationsFileNamePatternRaw === 'prefix-timestamp'
          ? 'prefix-timestamp'
          : 'timestamp-prefix';

      merged.migrations = {
        outputDir: migrationsOutputDir ?? defaultConfig.migrations.outputDir,
        fileNamePattern,
      };
    }

    return this.normalize(merged);
  }

  private static loadFromFileRaw(pathStr: string): Partial<AppConfig> {
    const absolutePath = resolve(process.cwd(), pathStr);
    if (!existsSync(absolutePath)) {
      throw new DbUtilityError('APP_CONFIG_FILE_NOT_FOUND', absolutePath);
    }

    const ext = extname(absolutePath);
    if (ext === '.json' || ext === '') {
      const content = readFileSync(absolutePath, 'utf-8');
      return JSON.parse(content) as Partial<AppConfig>;
    }

    throw new DbUtilityError('APP_CONFIG_FILE_FORMAT_UNSUPPORTED', ext);
  }

  private static loadFromEnvRaw(): Partial<AppConfig> {
    const rawLanguage =
      process.env.DB_UTILITY_LANG || process.env.DB_UTILITY_LANGUAGE || process.env.LANG;

    const rawIntrospectionOutputDir = process.env.DB_UTILITY_INTROSPECTION_OUTPUT_DIR;
    const rawMigrationsOutputDir = process.env.DB_UTILITY_MIGRATIONS_OUTPUT_DIR;
    const rawMigrationsFileNamePattern = process.env.DB_UTILITY_MIGRATIONS_FILE_NAME_PATTERN;

    const config: Partial<AppConfig> = {};

    if (rawLanguage) {
      config.language = this.normalizeLanguage(rawLanguage);
    }

    if (rawIntrospectionOutputDir) {
      config.introspection = { outputDir: rawIntrospectionOutputDir };
    }

    if (rawMigrationsOutputDir || rawMigrationsFileNamePattern) {
      const fileNamePattern: 'timestamp-prefix' | 'prefix-timestamp' =
        rawMigrationsFileNamePattern === 'prefix-timestamp'
          ? 'prefix-timestamp'
          : 'timestamp-prefix';

      config.migrations = {
        outputDir: rawMigrationsOutputDir ?? defaultConfig.migrations.outputDir,
        fileNamePattern,
      };
    }

    return config;
  }

  private static normalize(raw: Partial<AppConfig>): AppConfig {
    const language = raw.language ? this.normalizeLanguage(raw.language) : defaultConfig.language;

    const introspectionOutputDir =
      raw.introspection && raw.introspection.outputDir
        ? raw.introspection.outputDir
        : defaultConfig.introspection.outputDir;

    const migrationsOutputDir =
      raw.migrations && raw.migrations.outputDir
        ? raw.migrations.outputDir
        : defaultConfig.migrations.outputDir;

    const fileNamePatternRaw =
      raw.migrations && raw.migrations.fileNamePattern
        ? raw.migrations.fileNamePattern
        : defaultConfig.migrations.fileNamePattern;

    const fileNamePattern: 'timestamp-prefix' | 'prefix-timestamp' =
      fileNamePatternRaw === 'prefix-timestamp' ? 'prefix-timestamp' : 'timestamp-prefix';

    return {
      language,
      introspection: {
        outputDir: introspectionOutputDir,
      },
      migrations: {
        outputDir: migrationsOutputDir,
        fileNamePattern,
      },
    };
  }

  private static normalizeLanguage(value: string): AppLanguage {
    const normalized = value.toLowerCase();

    if (normalized === 'pt' || normalized === 'pt-br' || normalized === 'pt_br') {
      return 'pt-BR';
    }

    if (normalized === 'en' || normalized === 'en-us' || normalized === 'en_gb') {
      return 'en';
    }

    if (normalized === 'es' || normalized === 'es-es' || normalized === 'es_mx') {
      return 'es';
    }

    return defaultConfig.language;
  }
}

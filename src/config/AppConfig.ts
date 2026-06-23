import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { DbUtilityError } from '../errors/DbUtilityError';

dotenv.config();

export type AppLanguage = 'pt-BR' | 'en' | 'es';

export interface DataTableConfig {
  table: string;
  where?: string;
  disableIdentity?: boolean;
}

export interface MigrationConfig {
  outputDir?: string;
  fileNamePattern: 'timestamp-prefix' | 'prefix-timestamp';
  data?: boolean;
  dataTables?: (string | DataTableConfig)[];
  backup?: boolean;
  disableForeignKeys?: boolean;
  connectionName?: string;
}

export type AppMigrationsConfig = MigrationConfig | MigrationConfig[];

export interface VersionCheckConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
}

export interface AppConfig {
  language: AppLanguage;
  target?: string;
  versionCheck?: VersionCheckConfig;
  introspection: {
    outputDir: string;
  };
  migrations: AppMigrationsConfig;
}

type RawMigrationConfig = Partial<MigrationConfig>;
type RawMigrationsConfig = RawMigrationConfig | RawMigrationConfig[];
type RawAppConfig = Omit<Partial<AppConfig>, 'migrations'> & {
  migrations?: RawMigrationsConfig;
};

const defaultMigrationConfig: MigrationConfig = {
  outputDir: 'db-utility-migrations',
  fileNamePattern: 'timestamp-prefix',
  data: false,
  dataTables: [],
  backup: false,
  disableForeignKeys: false,
};

const defaultConfig: AppConfig = {
  language: 'pt-BR',
  versionCheck: {
    enabled: true,
    frequency: 'daily',
  },
  introspection: {
    outputDir: 'db-utility-introspect',
  },
  migrations: defaultMigrationConfig,
};

export const getMigrationConfigEntries = (migrations: AppMigrationsConfig): MigrationConfig[] =>
  Array.isArray(migrations) ? migrations : [migrations];

export const getPrimaryMigrationConfig = (migrations: AppMigrationsConfig): MigrationConfig =>
  Array.isArray(migrations) ? (migrations[0] ?? defaultMigrationConfig) : migrations;

export class AppConfigLoader {
  static load(configPath?: string): AppConfig {
    const fromEnv = this.loadFromEnvRaw();
    let fromFile: RawAppConfig = {};

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
    const merged: RawAppConfig = {
      language: fromFile.language || fromEnv.language,
      target: fromFile.target || fromEnv.target,
    };

    const envVersionCheck = fromEnv.versionCheck;
    const fileVersionCheck = fromFile.versionCheck;

    if (envVersionCheck || fileVersionCheck) {
      merged.versionCheck = {
        enabled:
          fileVersionCheck?.enabled ??
          envVersionCheck?.enabled ??
          defaultConfig.versionCheck!.enabled,
        frequency:
          fileVersionCheck?.frequency ??
          envVersionCheck?.frequency ??
          defaultConfig.versionCheck!.frequency,
      };
    }

    const envIntrospection = fromEnv.introspection;
    const fileIntrospection = fromFile.introspection;
    const introspectionOutputDir = fileIntrospection?.outputDir ?? envIntrospection?.outputDir;

    if (introspectionOutputDir) {
      merged.introspection = {
        outputDir: introspectionOutputDir,
      };
    }

    const envMigrations = Array.isArray(fromEnv.migrations) ? undefined : fromEnv.migrations;
    const mergedMigrations = this.mergeMigrationsConfig(fromFile.migrations, envMigrations);
    if (mergedMigrations !== undefined) {
      merged.migrations = mergedMigrations;
    }

    return this.normalize(merged);
  }

  private static loadFromFileRaw(pathStr: string): RawAppConfig {
    const absolutePath = resolve(process.cwd(), pathStr);
    if (!existsSync(absolutePath)) {
      throw new DbUtilityError('APP_CONFIG_FILE_NOT_FOUND', absolutePath);
    }

    const ext = extname(absolutePath);
    if (ext === '.json' || ext === '') {
      const content = readFileSync(absolutePath, 'utf-8');
      return JSON.parse(content) as RawAppConfig;
    }

    throw new DbUtilityError('APP_CONFIG_FILE_FORMAT_UNSUPPORTED', ext);
  }

  private static loadFromEnvRaw(): RawAppConfig {
    const rawLanguage =
      process.env.DB_UTILITY_LANG ||
      process.env.DB_UTILITY_LANGUAGE ||
      process.env.DBUTILITY_LANG ||
      process.env.DBUTILITY_LANGUAGE ||
      process.env.LANG;
    const rawTarget = process.env.DB_UTILITY_TARGET || process.env.DBUTILITY_TARGET;

    const rawVersionCheckEnabled = process.env.DB_UTILITY_VERSION_CHECK_ENABLED;
    const rawVersionCheckFrequency = process.env.DB_UTILITY_VERSION_CHECK_FREQUENCY;

    const rawIntrospectionOutputDir =
      process.env.DB_UTILITY_INTROSPECTION_OUTPUT_DIR ||
      process.env.DBUTILITY_INTROSPECTION_OUTPUT_DIR;
    const rawMigrationsOutputDir =
      process.env.DB_UTILITY_MIGRATIONS_OUTPUT_DIR || process.env.DBUTILITY_MIGRATIONS_OUTPUT_DIR;
    const rawMigrationsFileNamePattern =
      process.env.DB_UTILITY_MIGRATIONS_FILE_NAME_PATTERN ||
      process.env.DBUTILITY_MIGRATIONS_FILE_NAME_PATTERN;
    const rawMigrationsData =
      process.env.DB_UTILITY_MIGRATIONS_DATA || process.env.DBUTILITY_MIGRATIONS_DATA;
    const rawMigrationsDataTables =
      process.env.DB_UTILITY_MIGRATIONS_DATA_TABLES || process.env.DBUTILITY_MIGRATIONS_DATA_TABLES;
    const rawMigrationsBackup =
      process.env.DB_UTILITY_MIGRATIONS_BACKUP || process.env.DBUTILITY_MIGRATIONS_BACKUP;
    const rawMigrationsDisableForeignKeys =
      process.env.DB_UTILITY_MIGRATIONS_DISABLE_FOREIGN_KEYS ||
      process.env.DBUTILITY_MIGRATIONS_DISABLE_FOREIGN_KEYS;

    const config: RawAppConfig = {};

    if (rawLanguage) {
      config.language = this.normalizeLanguage(rawLanguage);
    }
    if (rawTarget) {
      config.target = rawTarget;
    }

    if (rawVersionCheckEnabled !== undefined || rawVersionCheckFrequency) {
      config.versionCheck = {
        enabled: rawVersionCheckEnabled !== 'false',
        frequency: (rawVersionCheckFrequency as 'daily' | 'weekly' | 'monthly') || 'daily',
      };
    }

    if (rawIntrospectionOutputDir) {
      config.introspection = { outputDir: rawIntrospectionOutputDir };
    }

    if (
      rawMigrationsOutputDir ||
      rawMigrationsFileNamePattern ||
      rawMigrationsData ||
      rawMigrationsDataTables ||
      rawMigrationsBackup ||
      rawMigrationsDisableForeignKeys
    ) {
      const fileNamePattern: 'timestamp-prefix' | 'prefix-timestamp' =
        rawMigrationsFileNamePattern === 'prefix-timestamp'
          ? 'prefix-timestamp'
          : 'timestamp-prefix';

      const data = rawMigrationsData ? rawMigrationsData === 'true' : undefined;

      const dataTables: (string | DataTableConfig)[] | undefined = rawMigrationsDataTables
        ? rawMigrationsDataTables.split(',').map((t) => t.trim())
        : undefined;

      const backup = rawMigrationsBackup ? rawMigrationsBackup === 'true' : undefined;
      const disableForeignKeys = rawMigrationsDisableForeignKeys
        ? rawMigrationsDisableForeignKeys === 'true'
        : undefined;

      config.migrations = this.mergeMigrationConfig(
        {
          ...(rawMigrationsOutputDir ? { outputDir: rawMigrationsOutputDir } : {}),
          ...(data === undefined ? {} : { data }),
          ...(dataTables ? { dataTables } : {}),
          ...(backup === undefined ? {} : { backup }),
          ...(disableForeignKeys === undefined ? {} : { disableForeignKeys }),
        },
        undefined,
        fileNamePattern,
      );
    }

    return config;
  }

  private static normalize(raw: RawAppConfig): AppConfig {
    const language = raw.language ? this.normalizeLanguage(raw.language) : defaultConfig.language;
    const target = raw.target;

    const versionCheck: VersionCheckConfig = {
      enabled: raw.versionCheck?.enabled ?? defaultConfig.versionCheck!.enabled,
      frequency: raw.versionCheck?.frequency || defaultConfig.versionCheck!.frequency,
    };

    const introspectionOutputDir = raw.introspection?.outputDir
      ? raw.introspection.outputDir
      : defaultConfig.introspection.outputDir;

    return {
      language,
      ...(target ? { target } : {}),
      versionCheck,
      introspection: {
        outputDir: introspectionOutputDir,
      },
      migrations: this.normalizeMigrationsConfig(raw.migrations),
    };
  }

  private static mergeMigrationsConfig(
    fileMigrations?: RawMigrationsConfig,
    envMigrations?: RawMigrationConfig,
  ): RawMigrationsConfig | undefined {
    if (Array.isArray(fileMigrations)) {
      return fileMigrations.map((entry) => this.mergeMigrationConfig(entry, envMigrations));
    }

    if (fileMigrations || envMigrations) {
      return this.mergeMigrationConfig(fileMigrations, envMigrations);
    }

    return undefined;
  }

  private static mergeMigrationConfig(
    fileMigration?: RawMigrationConfig,
    envMigration?: RawMigrationConfig,
    fileNamePatternOverride?: 'timestamp-prefix' | 'prefix-timestamp',
  ): RawMigrationConfig {
    const outputDir = fileMigration?.outputDir ?? envMigration?.outputDir;
    const fileNamePatternRaw =
      fileNamePatternOverride ??
      fileMigration?.fileNamePattern ??
      envMigration?.fileNamePattern ??
      defaultMigrationConfig.fileNamePattern;
    const data = fileMigration?.data ?? envMigration?.data;
    const dataTables = fileMigration?.dataTables ?? envMigration?.dataTables;
    const backup = fileMigration?.backup ?? envMigration?.backup;
    const disableForeignKeys =
      fileMigration?.disableForeignKeys ?? envMigration?.disableForeignKeys;
    const connectionName = fileMigration?.connectionName;

    return {
      fileNamePattern:
        fileNamePatternRaw === 'prefix-timestamp' ? 'prefix-timestamp' : 'timestamp-prefix',
      ...(outputDir ? { outputDir } : {}),
      ...(data === undefined ? {} : { data }),
      ...(dataTables ? { dataTables } : {}),
      ...(backup === undefined ? {} : { backup }),
      ...(disableForeignKeys === undefined ? {} : { disableForeignKeys }),
      ...(connectionName ? { connectionName } : {}),
    };
  }

  private static normalizeMigrationsConfig(raw?: RawMigrationsConfig): AppMigrationsConfig {
    if (Array.isArray(raw)) {
      return raw.map((entry) => this.normalizeMigrationConfig(entry));
    }

    return this.normalizeMigrationConfig(raw);
  }

  private static normalizeMigrationConfig(raw?: RawMigrationConfig): MigrationConfig {
    const outputDir = raw?.outputDir ?? defaultMigrationConfig.outputDir;
    const fileNamePatternRaw = raw?.fileNamePattern ?? defaultMigrationConfig.fileNamePattern;
    const data = raw?.data ?? defaultMigrationConfig.data;
    const dataTables = raw?.dataTables ?? defaultMigrationConfig.dataTables;
    const backup = raw?.backup ?? defaultMigrationConfig.backup;
    const disableForeignKeys = raw?.disableForeignKeys ?? defaultMigrationConfig.disableForeignKeys;
    const connectionName = raw?.connectionName;

    return {
      fileNamePattern:
        fileNamePatternRaw === 'prefix-timestamp' ? 'prefix-timestamp' : 'timestamp-prefix',
      data,
      dataTables,
      backup,
      disableForeignKeys,
      ...(outputDir ? { outputDir } : {}),
      ...(connectionName ? { connectionName } : {}),
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

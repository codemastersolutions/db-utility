import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseConfig } from '../../types/database';
import { MigrationRunner, MigrationRunnerOptions } from './MigrationRunner';

const localRequire = createRequire(__filename);

const formatSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

const defaultTypeOrmLogger = (connectionLabel: string) => {
  return {
    log: (level: 'log' | 'info' | 'warn', message: unknown) => {
      const text = typeof message === 'string' ? message : JSON.stringify(message);
      const prefix =
        level === 'warn'
          ? `[${connectionLabel} typeorm-warn]`
          : `[${connectionLabel} typeorm-info]`;
      console.log(`  ${prefix} ${text}`);
    },
    logMigration: (message: string) => {
      console.log(`  → [${connectionLabel} migration] ${message}`);
    },
    logQuery: (query: string, parameters?: unknown[]) => {
      const formatted = formatSql(query);
      const params =
        Array.isArray(parameters) && parameters.length > 0 ? ` ${JSON.stringify(parameters)}` : '';
      console.log(`  → [${connectionLabel} sql] ${formatted}${params}`);
    },
    logQueryError: (error: string, query: string, parameters?: unknown[]) => {
      const formatted = formatSql(query);
      const params =
        Array.isArray(parameters) && parameters.length > 0 ? ` ${JSON.stringify(parameters)}` : '';
      console.error(`  ✗ [${connectionLabel} sql-error] ${error} :: ${formatted}${params}`);
    },
    logQuerySlow: (time: number, query: string, parameters?: unknown[]) => {
      const formatted = formatSql(query);
      const params =
        Array.isArray(parameters) && parameters.length > 0 ? ` ${JSON.stringify(parameters)}` : '';
      console.warn(`  ⚠ [${connectionLabel} sql-slow ${time}ms] ${formatted}${params}`);
    },
    logSchemaBuild: (message: string) => {
      console.log(`  [${connectionLabel} schema] ${message}`);
    },
    logEvent: (event: Record<string, unknown>) => {
      console.log(`  [${connectionLabel} event] ${JSON.stringify(event)}`);
    },
  };
};

export class TypeORMRunner implements MigrationRunner {
  private ormPath?: string;

  constructor(ormPath?: string) {
    this.ormPath = ormPath;
  }

  async run(
    migrationsDir: string,
    config: DatabaseConfig,
    options?: MigrationRunnerOptions,
  ): Promise<void> {
    const cwd = process.cwd();
    let DataSourceClass;

    try {
      let typeormPkg;
      if (this.ormPath) {
        typeormPkg = localRequire(this.ormPath);
      } else {
        // Try to load from user's project
        try {
          typeormPkg = localRequire(join(cwd, 'node_modules', 'typeorm'));
        } catch {
          typeormPkg = localRequire('typeorm');
        }
      }
      DataSourceClass = typeormPkg.DataSource;
    } catch {
      throw new Error('TypeORM not found. Please install typeorm in your project to run tests.');
    }

    // Try to register ts-node for handling .ts files
    try {
      localRequire(join(cwd, 'node_modules', 'ts-node')).register({
        transpileOnly: true,
        compilerOptions: {
          module: 'commonjs',
        },
      });
    } catch {
      console.warn(
        'ts-node not found. If your migrations are in TypeScript, they might fail to load.',
      );
    }

    const extra =
      config.type === 'mssql'
        ? {
            options: {
              encrypt: !!config.ssl,
              trustServerCertificate: !config.ssl,
            },
          }
        : config.ssl
          ? { ssl: { rejectUnauthorized: false } }
          : undefined;

    const sqlLoggingEnabled = options?.logging !== false;
    const connectionLabel = `typeorm → ${config.host ?? 'localhost'}:${config.port ?? '?'}/${
      config.database ?? '?'
    }`;

    const dataSource = new DataSourceClass({
      type: config.type,
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      synchronize: false,
      logging: sqlLoggingEnabled ? 'all' : false,
      logger: sqlLoggingEnabled ? defaultTypeOrmLogger(connectionLabel) : undefined,
      entities: [],
      migrations: [],
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      extra,
    });

    try {
      await dataSource.initialize();
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();

      const files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
        .sort((a, b) => {
          // TypeORM timestamps are usually at the start
          const timeA = parseInt(a.split('-')[0]);
          const timeB = parseInt(b.split('-')[0]);
          return timeA - timeB;
        });

      for (const file of files) {
        console.log(`→ Running migration: ${file} (SQL will be logged as it executes)`);
        const migrationPath = join(migrationsDir, file);

        // Dynamic import/require
        const migrationModule = localRequire(migrationPath);

        // TypeORM migrations export a class. We need to find it.
        // Usually keys are the class name.
        const keys = Object.keys(migrationModule);
        const MigrationClass = migrationModule[keys[0]];

        if (typeof MigrationClass === 'function') {
          const instance = new MigrationClass();
          if (instance.up) {
            await instance.up(queryRunner);
          }
        }
        console.log(`✓ Migration completed: ${file}`);
      }

      await queryRunner.release();
    } finally {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  }
}

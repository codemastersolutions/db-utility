import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseConfig } from '../../types/database';
import { MigrationRunner, MigrationRunnerOptions } from './MigrationRunner';

const localRequire = createRequire(__filename);

const formatSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

const defaultSequelizeLogger =
  (connectionLabel: string) =>
  (sql: string, elapsedMs?: number): void => {
    const timing =
      typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) ? `${elapsedMs}ms` : '?ms';
    const preview = formatSql(sql);
    console.log(`  ← [${connectionLabel} sql] (${timing}) ${preview}`);
  };

export class SequelizeRunner implements MigrationRunner {
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
    let SequelizeClass;

    try {
      let sequelizePkg;
      if (this.ormPath) {
        // If specific path provided (e.g. global or specific version)
        sequelizePkg = localRequire(this.ormPath);
      } else {
        // Try to load from user's project
        try {
          sequelizePkg = localRequire(join(cwd, 'node_modules', 'sequelize'));
        } catch {
          // Try standard require
          sequelizePkg = localRequire('sequelize');
        }
      }
      SequelizeClass = sequelizePkg.Sequelize;
    } catch {
      throw new Error(
        'Sequelize not found. Please install sequelize in your project to run tests.',
      );
    }

    const sqlLoggingEnabled = options?.logging !== false;
    const connectionLabel = `sequelize → ${config.host ?? 'localhost'}:${config.port ?? '?'}/${
      config.database ?? '?'
    }`;

    const sequelize = new SequelizeClass(config.database!, config.username!, config.password!, {
      host: config.host,
      port: config.port,
      dialect:
        config.type === 'mssql' ? 'mssql' : config.type === 'postgres' ? 'postgres' : 'mysql',
      logging: sqlLoggingEnabled ? defaultSequelizeLogger(connectionLabel) : false,
      benchmark: true,
      dialectOptions: {
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
        ...(config.ssl
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false,
              },
            }
          : {}),
      },
    });

    try {
      await sequelize.authenticate();
      const queryInterface = sequelize.getQueryInterface();

      const files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.js') && !f.endsWith('.d.ts')) // Sequelize migrations are usually JS in this tool
        .sort(); // Ensure chronological order

      for (const file of files) {
        console.log(`→ Running migration: ${file} (SQL will be logged as it executes)`);
        const migrationPath = join(migrationsDir, file);
        const migration = localRequire(migrationPath);

        await migration.up(queryInterface, SequelizeClass);
        console.log(`✓ Migration completed: ${file}`);
      }
    } finally {
      await sequelize.close();
    }
  }
}

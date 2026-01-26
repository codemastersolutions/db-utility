import { join } from 'path';
import { readdirSync } from 'fs';
import { DatabaseConfig } from '../../types/database';
import { MigrationRunner } from './MigrationRunner';

export class SequelizeRunner implements MigrationRunner {
  private ormPath?: string;

  constructor(ormPath?: string) {
    this.ormPath = ormPath;
  }

  async run(migrationsDir: string, config: DatabaseConfig): Promise<void> {
    const cwd = process.cwd();
    let SequelizeClass;

    try {
      let sequelizePkg;
      if (this.ormPath) {
        // If specific path provided (e.g. global or specific version)
        sequelizePkg = require(this.ormPath);
      } else {
        // Try to load from user's project
        try {
          sequelizePkg = require(join(cwd, 'node_modules', 'sequelize'));
        } catch {
          // Try standard require
          sequelizePkg = require('sequelize');
        }
      }
      SequelizeClass = sequelizePkg.Sequelize;
    } catch (e) {
      throw new Error(
        'Sequelize not found. Please install sequelize in your project to run tests.',
      );
    }

    const sequelize = new SequelizeClass(config.database!, config.username!, config.password!, {
      host: config.host,
      port: config.port,
      dialect:
        config.type === 'mssql' ? 'mssql' : config.type === 'postgres' ? 'postgres' : 'mysql',
      logging: false,
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
        console.log(`Running migration: ${file}`);
        const migrationPath = join(migrationsDir, file);
        const migration = require(migrationPath);

        await migration.up(queryInterface, SequelizeClass);
      }
    } finally {
      await sequelize.close();
    }
  }
}

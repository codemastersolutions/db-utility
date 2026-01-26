import { join } from 'path';
import { readdirSync } from 'fs';
import { DatabaseConfig } from '../../types/database';
import { MigrationRunner } from './MigrationRunner';

export class TypeORMRunner implements MigrationRunner {
  private ormPath?: string;

  constructor(ormPath?: string) {
    this.ormPath = ormPath;
  }

  async run(migrationsDir: string, config: DatabaseConfig): Promise<void> {
    const cwd = process.cwd();
    let DataSourceClass;

    try {
      let typeormPkg;
      if (this.ormPath) {
        typeormPkg = require(this.ormPath);
      } else {
        // Try to load from user's project
        try {
          typeormPkg = require(join(cwd, 'node_modules', 'typeorm'));
        } catch {
          typeormPkg = require('typeorm');
        }
      }
      DataSourceClass = typeormPkg.DataSource;
    } catch (e) {
      throw new Error('TypeORM not found. Please install typeorm in your project to run tests.');
    }

    // Try to register ts-node for handling .ts files
    try {
      require(join(cwd, 'node_modules', 'ts-node')).register({
        transpileOnly: true,
        compilerOptions: {
          module: 'commonjs',
        },
      });
    } catch (e) {
      console.warn(
        'ts-node not found. If your migrations are in TypeScript, they might fail to load.',
      );
    }

    const dataSource = new DataSourceClass({
      type: config.type,
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      synchronize: false,
      logging: false,
      entities: [],
      migrations: [],
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      extra: config.ssl ? { ssl: { rejectUnauthorized: false } } : undefined,
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
        console.log(`Running migration: ${file}`);
        const migrationPath = join(migrationsDir, file);

        // Dynamic import/require
        const migrationModule = require(migrationPath);

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
      }

      await queryRunner.release();
    } finally {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  }
}

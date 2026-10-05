import { DatabaseConfig } from '../../types/database';

export interface MigrationRunnerOptions {
  /**
   * When true (default), the runner prints every SQL statement that the ORM
   * sends to the database, including elapsed time. Set to false (or pass
   * `--no-sql-log` on the CLI / `migrations.test.logging: false` in config)
   * to silence the SQL log.
   */
  logging?: boolean;
}

export interface MigrationRunner {
  run(
    migrationsDir: string,
    config: DatabaseConfig,
    options?: MigrationRunnerOptions,
  ): Promise<void>;
}

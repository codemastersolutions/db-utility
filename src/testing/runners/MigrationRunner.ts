import { DatabaseConfig } from '../../types/database';

export interface MigrationRunner {
  run(migrationsDir: string, config: DatabaseConfig): Promise<void>;
}

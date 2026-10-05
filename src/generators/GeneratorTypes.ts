import { DatabaseType } from '../types/database';
import { DatabaseSchema, TableData } from '../types/introspection';
import { MigrationTestDatabaseConfig } from '../config/AppConfig';

export interface GeneratedFile {
  fileName: string;
  content: string;
}

export interface SchemaGenerator {
  generate(schema: DatabaseSchema): Promise<GeneratedFile[]>;
}

export interface MigrationGenerationOptions {
  disableForeignKeys?: boolean;
  disableTableExistsCheck?: boolean;
  databaseType?: DatabaseType;
  testDatabase?: MigrationTestDatabaseConfig;
}

export interface MigrationGenerator {
  generateMigrations(
    schema: DatabaseSchema,
    data?: TableData[],
    options?: MigrationGenerationOptions,
  ): Promise<GeneratedFile[]>;
}

export interface DataMigrationGenerator {
  generateDataMigrations(data: TableData[]): Promise<GeneratedFile[]>;
}

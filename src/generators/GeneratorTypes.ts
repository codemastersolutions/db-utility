import { DatabaseSchema, TableData } from '../types/introspection';

export interface GeneratedFile {
  fileName: string;
  content: string;
}

export interface SchemaGenerator {
  generate(schema: DatabaseSchema): Promise<GeneratedFile[]>;
}

export interface MigrationGenerationOptions {
  disableForeignKeys?: boolean;
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

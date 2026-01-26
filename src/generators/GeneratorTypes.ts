import { DatabaseSchema, TableData } from '../types/introspection';

export interface GeneratedFile {
  fileName: string;
  content: string;
}

export interface SchemaGenerator {
  generate(schema: DatabaseSchema): Promise<GeneratedFile[]>;
}

export interface MigrationGenerator {
  generateMigrations(schema: DatabaseSchema, data?: TableData[]): Promise<GeneratedFile[]>;
}

export interface DataMigrationGenerator {
  generateDataMigrations(data: TableData[]): Promise<GeneratedFile[]>;
}

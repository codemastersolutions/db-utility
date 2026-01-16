import { DatabaseSchema } from '../types/introspection';

export interface GeneratedFile {
  fileName: string;
  content: string;
}

export interface SchemaGenerator {
  generate(schema: DatabaseSchema): Promise<GeneratedFile[]>;
}

export interface MigrationGenerator {
  generate(schema: DatabaseSchema): Promise<GeneratedFile[]>;
}

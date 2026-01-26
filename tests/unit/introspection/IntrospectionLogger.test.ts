import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { IntrospectionLogger } from '../../../src/introspection/IntrospectionLogger';
import { DatabaseConfig } from '../../../src/types/database';
import { DatabaseSchema } from '../../../src/types/introspection';

describe('IntrospectionLogger', () => {
  const baseTempDir = mkdtempSync(join(tmpdir(), 'db-utility-introspect-test-'));

  afterAll(() => {
    rmSync(baseTempDir, { recursive: true, force: true });
  });

  it('deve criar diretório e arquivos de log de introspecção', () => {
    const config: DatabaseConfig = {
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'dbutility_test',
    };

    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'customers',
          columns: [],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    const runDir = IntrospectionLogger.logSchema(config, schema, baseTempDir, {
      language: 'pt-BR',
      introspection: {
        outputDir: 'introspect-out',
      },
      migrations: {
        outputDir: 'migrations-out',
        fileNamePattern: 'timestamp-prefix',
      },
    });

    const schemaContent = readFileSync(join(runDir, 'schema.json'), 'utf-8');
    const metadataContent = readFileSync(join(runDir, 'metadata.json'), 'utf-8');

    const parsedSchema = JSON.parse(schemaContent) as DatabaseSchema;
    const parsedMetadata = JSON.parse(metadataContent) as {
      type: string;
      database?: string;
      tablesCount: number;
    };

    expect(parsedSchema.tables.length).toBe(1);
    expect(parsedSchema.tables[0].name).toBe('customers');
    expect(parsedMetadata.type).toBe('postgres');
    expect(parsedMetadata.database).toBe('dbutility_test');
    expect(parsedMetadata.tablesCount).toBe(1);
  });
});

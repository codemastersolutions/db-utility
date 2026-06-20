import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
      tablesOver32Columns: Array<{ tableName: string; columnCount: number }>;
      indexesOver32KeyColumns: Array<{
        tableName: string;
        indexName: string;
        keyColumnCount: number;
      }>;
    };

    expect(parsedSchema.tables.length).toBe(1);
    expect(parsedSchema.tables[0].name).toBe('customers');
    expect(parsedMetadata.type).toBe('postgres');
    expect(parsedMetadata.database).toBe('dbutility_test');
    expect(parsedMetadata.tablesCount).toBe(1);
    expect(parsedMetadata.tablesOver32Columns).toEqual([]);
    expect(parsedMetadata.indexesOver32KeyColumns).toEqual([]);
  });

  it('should identify tables with more than 32 columns in metadata', () => {
    const config: DatabaseConfig = {
      type: 'mssql',
      host: 'localhost',
      port: 1433,
      database: 'dbutility_test',
    };

    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'LPUBLIC',
          columns: Array.from({ length: 33 }, (_, index) => ({
            name: `COL_${index + 1}`,
            dataType: 'varchar',
            isNullable: true,
            hasDefault: false,
            isPrimaryKey: false,
            isUnique: false,
            isAutoIncrement: false,
          })),
          indexes: [
            {
              name: 'LXLPUBLIC_01',
              columns: Array.from({ length: 33 }, (_, index) => `COL_${index + 1}`),
              isPrimary: false,
              isUnique: false,
            },
          ],
          foreignKeys: [],
        },
      ],
    };

    const runDir = IntrospectionLogger.logSchema(config, schema, baseTempDir);
    const metadataContent = readFileSync(join(runDir, 'metadata.json'), 'utf-8');
    const parsedMetadata = JSON.parse(metadataContent) as {
      tablesOver32Columns: Array<{ tableName: string; columnCount: number }>;
      indexesOver32KeyColumns: Array<{
        tableName: string;
        indexName: string;
        keyColumnCount: number;
      }>;
    };

    expect(parsedMetadata.tablesOver32Columns).toEqual([
      { tableName: 'LPUBLIC', columnCount: 33 },
    ]);
    expect(parsedMetadata.indexesOver32KeyColumns).toHaveLength(1);
    expect(parsedMetadata.indexesOver32KeyColumns[0]).toMatchObject({
      tableName: 'LPUBLIC',
      indexName: 'LXLPUBLIC_01',
      keyColumnCount: 33,
    });
  });
});

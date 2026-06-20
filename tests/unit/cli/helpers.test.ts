import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildIntrospectionWarnings,
  resolveMigrationOutputDir,
} from '../../../src/cli/helpers';
import { AppConfig } from '../../../src/config/AppConfig';
import { DatabaseSchema } from '../../../src/types/introspection';

describe('CLI Helpers - resolveMigrationOutputDir', () => {
  const cwd = '/test/cwd';
  const mockAppConfig: AppConfig = {
    language: 'en',
    introspection: { outputDir: 'intro' },
    migrations: { outputDir: 'config-migrations', fileNamePattern: 'timestamp-prefix' },
  };

  it('deve usar a opção da CLI se fornecida', () => {
    const result = resolveMigrationOutputDir(cwd, 'cli-migrations', mockAppConfig);
    expect(result).toBe('cli-migrations');
  });

  it('deve usar o outputDir do AppConfig se a opção da CLI não for fornecida', () => {
    const result = resolveMigrationOutputDir(cwd, undefined, mockAppConfig);
    expect(result).toBe(join(cwd, 'config-migrations'));
  });

  it('deve usar o fallback hardcoded se não houver CLI nem AppConfig migration dir', () => {
    // Simulando um AppConfig vazio ou sem migrations (embora o loader garanta defaults, é bom testar o fallback da função)
    const emptyConfig = { ...mockAppConfig, migrations: undefined } as unknown as AppConfig;
    const result = resolveMigrationOutputDir(cwd, undefined, emptyConfig);
    expect(result).toBe(join(cwd, 'exports', 'migrations'));
  });
});

describe('CLI Helpers - buildIntrospectionWarnings', () => {
  const messages = {
    schemaLimitSummary: 'summary',
    tablesOverColumnLimit: (count: number) => `tables:${count}`,
    tableOverColumnLimitItem: (tableName: string, columnCount: number) =>
      `table:${tableName}:${columnCount}`,
    indexesOverKeyColumnLimit: (count: number) => `indexes:${count}`,
    indexOverKeyColumnLimitItem: (tableName: string, indexName: string, keyColumnCount: number) =>
      `index:${tableName}:${indexName}:${keyColumnCount}`,
    schemaLimitMetadataHint: 'metadata-hint',
  };

  it('should return no warnings when schema is within limits', () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'Customers',
          columns: [
            {
              name: 'ID',
              dataType: 'int',
              isNullable: false,
              hasDefault: false,
              isPrimaryKey: true,
              isUnique: true,
              isAutoIncrement: true,
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    expect(buildIntrospectionWarnings(schema, messages)).toEqual([]);
  });

  it('should build warnings for oversized tables and indexes', () => {
    const columnNames = Array.from({ length: 33 }, (_, index) => `COL_${index + 1}`);
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'LPUBLIC',
          columns: columnNames.map((name) => ({
            name,
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
              columns: columnNames,
              isPrimary: false,
              isUnique: false,
            },
          ],
          foreignKeys: [],
        },
      ],
    };

    expect(buildIntrospectionWarnings(schema, messages)).toEqual([
      'summary',
      'tables:1',
      'table:LPUBLIC:33',
      'indexes:1',
      'index:LPUBLIC:LXLPUBLIC_01:33',
      'metadata-hint',
    ]);
  });
});

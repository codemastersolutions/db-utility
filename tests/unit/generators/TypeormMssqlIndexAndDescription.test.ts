import { describe, expect, it } from 'vitest';
import { TypeORMGenerator } from '../../../src/generators/TypeORMGenerator';
import { DatabaseSchema } from '../../../src/types/introspection';

function makeTable(
  overrides: Partial<DatabaseSchema['tables'][number]> = {},
): DatabaseSchema['tables'][number] {
  return {
    name: 'LTipoDocumentos',
    schemaName: 'dbo',
    columns: [
      {
        name: 'id',
        dataType: 'int',
        isPrimaryKey: true,
        isAutoIncrement: true,
        isNullable: false,
        hasDefault: false,
        isUnique: false,
      },
      {
        name: 'classe',
        dataType: 'varchar',
        isPrimaryKey: false,
        isAutoIncrement: false,
        isNullable: false,
        hasDefault: false,
        isUnique: false,
        maxLength: 255,
      },
      {
        name: 'nome',
        dataType: 'nvarchar',
        isPrimaryKey: false,
        isAutoIncrement: false,
        isNullable: false,
        hasDefault: false,
        isUnique: false,
        maxLength: 100,
        description: 'Nome do tipo de documento',
      },
    ],
    indexes: [],
    foreignKeys: [],
    description: 'Tabela de tipos de documentos',
    ...overrides,
  };
}

describe('TypeORM MSSQL index/description emission', () => {
  it('emits raw CREATE INDEX with WHERE clause for filtered indexes', async () => {
    const schema: DatabaseSchema = {
      tables: [
        makeTable({
          indexes: [
            {
              name: 'UX_LTipoDocumentos_classe_nome',
              columns: ['classe', 'nome'],
              isUnique: true,
              isPrimary: false,
              filterDefinition: '([deleted_at] IS NULL)',
            },
          ],
        }),
      ],
    };

    const generator = new TypeORMGenerator();
    const [migration] = await generator.generateMigrations(schema, undefined, {
      databaseType: 'mssql',
    });

    expect(migration.content).toContain(
      'CREATE UNIQUE INDEX [UX_LTipoDocumentos_classe_nome] ON [dbo].[LTipoDocumentos] ([classe], [nome]) WHERE ([deleted_at] IS NULL)',
    );
    expect(migration.content).toContain('queryRunner.query');
  });

  it('emits sp_addextendedproperty for table and column descriptions on MSSQL', async () => {
    const schema: DatabaseSchema = { tables: [makeTable()] };

    const generator = new TypeORMGenerator();
    const [migration] = await generator.generateMigrations(schema, undefined, {
      databaseType: 'mssql',
    });

    expect(migration.content).toContain("EXEC sp_addextendedproperty @name = N'MS_Description'");
    expect(migration.content).toContain("@level2type = N'COLUMN', @level2name = N'nome'");
  });

  it('does not emit filtered-index or extended-property SQL for non-MSSQL targets', async () => {
    const schema: DatabaseSchema = {
      tables: [
        makeTable({
          indexes: [
            {
              name: 'UX_LTipoDocumentos_classe_nome',
              columns: ['classe', 'nome'],
              isUnique: true,
              isPrimary: false,
              filterDefinition: '([deleted_at] IS NULL)',
            },
          ],
        }),
      ],
    };

    const generator = new TypeORMGenerator();
    const [migration] = await generator.generateMigrations(schema, undefined, {
      databaseType: 'postgres',
    });

    expect(migration.content).not.toContain('CREATE UNIQUE INDEX [UX_LTipoDocumentos_classe_nome]');
    expect(migration.content).not.toContain('sp_addextendedproperty');
  });
});

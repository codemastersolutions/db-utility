import { describe, expect, it } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { DatabaseSchema } from '../../../src/types/introspection';

describe('Sequelize Migration Defaults', () => {
  it('should convert legacy MSSQL CREATE DEFAULT statements to primitive defaults', async () => {
    const rawDefault = 'CREATE DEFAULT DEF_DLOGICNULL AS 0\r\nFOR [INDSELECAO]';
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'Teste',
          columns: [
            {
              name: 'INDSELECAO',
              dataType: 'smallint',
              isPrimaryKey: false,
              isAutoIncrement: false,
              isNullable: false,
              hasDefault: true,
              defaultValue: rawDefault,
              isUnique: false,
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    const generator = new SequelizeGenerator();
    const [migration] = await generator.generateMigrations(schema);

    expect(migration.content).toContain('defaultValue: 0');
    expect(migration.content).not.toContain('CREATE DEFAULT DEF_DLOGICNULL AS 0');
  });

  it('should keep empty string defaults in generated migrations', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'Teste',
          columns: [
            {
              name: 'CODIGO',
              dataType: 'varchar',
              isPrimaryKey: false,
              isAutoIncrement: false,
              isNullable: false,
              hasDefault: true,
              defaultValue: '',
              isUnique: false,
              maxLength: 10,
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    const generator = new SequelizeGenerator();
    const [migration] = await generator.generateMigrations(schema);

    expect(migration.content).toContain('defaultValue: ""');
  });

  it('should keep SQL expressions as Sequelize literals in generated migrations', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'Teste',
          columns: [
            {
              name: 'CRIADOEM',
              dataType: 'datetime',
              isPrimaryKey: false,
              isAutoIncrement: false,
              isNullable: false,
              hasDefault: true,
              defaultValue: '(getdate())',
              isUnique: false,
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    const generator = new SequelizeGenerator();
    const [migration] = await generator.generateMigrations(schema);

    expect(migration.content).toContain('defaultValue: Sequelize.literal("getdate()")');
  });

  it('should convert SQL string defaults to JavaScript string defaults', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'Teste',
          columns: [
            {
              name: 'NOME',
              dataType: 'nvarchar',
              isPrimaryKey: false,
              isAutoIncrement: false,
              isNullable: false,
              hasDefault: true,
              defaultValue: "(N'guest')",
              isUnique: false,
              maxLength: 100,
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    const generator = new SequelizeGenerator();
    const [migration] = await generator.generateMigrations(schema);

    expect(migration.content).toContain('defaultValue: "guest"');
  });

  it('should omit invalid numeric defaults for date columns', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'Teste',
          columns: [
            {
              name: 'DATAFECHAMENTOFACTOR',
              dataType: 'datetimeoffset',
              isPrimaryKey: false,
              isAutoIncrement: false,
              isNullable: true,
              hasDefault: true,
              defaultValue: '((0))',
              isUnique: false,
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    const generator = new SequelizeGenerator();
    const [migration] = await generator.generateMigrations(schema);

    expect(migration.content).toContain('type: Sequelize.DATE');
    expect(migration.content).not.toContain('defaultValue: 0');
    expect(migration.content).not.toContain('DATAFECHAMENTOFACTOR: {\n        type: Sequelize.DATE,\n        defaultValue');
  });
});

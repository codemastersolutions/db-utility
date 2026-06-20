import { describe, expect, it } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { DatabaseSchema } from '../../../src/types/introspection';

describe('Sequelize Migration Defaults', () => {
  it('should escape raw default SQL containing line breaks when generating migrations', async () => {
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

    expect(migration.content).toContain(
      `defaultValue: Sequelize.literal(${JSON.stringify(rawDefault)})`,
    );
    expect(migration.content).not.toContain("Sequelize.literal('CREATE DEFAULT");
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

    expect(migration.content).toContain('defaultValue: Sequelize.literal("")');
  });
});

import { describe, expect, it } from 'vitest';
import { MongooseGenerator } from '../../../src/generators/MongooseGenerator';
import { DatabaseSchema } from '../../../src/types/introspection';

describe('Mongoose Model Defaults', () => {
  it('should convert legacy MSSQL CREATE DEFAULT statements to primitive defaults', async () => {
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
              defaultValue: 'CREATE DEFAULT DEF_DLOGICNULL AS 0\r\nFOR [INDSELECAO]',
              isUnique: false,
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    const generator = new MongooseGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).toContain('default: 0');
    expect(model.content).not.toContain('CREATE DEFAULT DEF_DLOGICNULL AS 0');
  });

  it('should map SQL date functions to Date.now in mongoose models', async () => {
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

    const generator = new MongooseGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).toContain('default: Date.now');
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
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    const generator = new MongooseGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).toContain('default: "guest"');
  });

  it('should skip unsupported SQL expressions in mongoose models', async () => {
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
              defaultValue: '(newid())',
              isUnique: false,
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    const generator = new MongooseGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).not.toContain('default:');
  });
});

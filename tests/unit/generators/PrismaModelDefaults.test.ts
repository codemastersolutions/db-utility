import { describe, expect, it } from 'vitest';
import { PrismaGenerator } from '../../../src/generators/PrismaGenerator';
import { DatabaseSchema } from '../../../src/types/introspection';

describe('Prisma Model Defaults', () => {
  it('should convert legacy MSSQL CREATE DEFAULT statements to primitive defaults', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'Teste',
          columns: [
            {
              name: 'status',
              dataType: 'smallint',
              isPrimaryKey: false,
              isAutoIncrement: false,
              isNullable: false,
              hasDefault: true,
              defaultValue: 'CREATE DEFAULT DEF_DLOGICNULL AS 0\r\nFOR [status]',
              isUnique: false,
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    const generator = new PrismaGenerator();
    const [file] = await generator.generate(schema);

    expect(file.content).toContain('status Int @default(0)');
    expect(file.content).not.toContain('CREATE DEFAULT DEF_DLOGICNULL AS 0');
  });

  it('should convert SQL string defaults to Prisma string defaults', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'Teste',
          columns: [
            {
              name: 'name',
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

    const generator = new PrismaGenerator();
    const [file] = await generator.generate(schema);

    expect(file.content).toContain('name String @default("guest")');
  });

  it('should map SQL date functions to Prisma now()', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'Teste',
          columns: [
            {
              name: 'createdAt',
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

    const generator = new PrismaGenerator();
    const [file] = await generator.generate(schema);

    expect(file.content).toContain('createdAt DateTime @default(now())');
  });

  it('should skip unsupported SQL expressions in Prisma models', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'Teste',
          columns: [
            {
              name: 'codigo',
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

    const generator = new PrismaGenerator();
    const [file] = await generator.generate(schema);

    expect(file.content).toContain('codigo String');
    expect(file.content).not.toContain('codigo String @default(');
  });
});

import { describe, expect, it } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { TypeORMGenerator } from '../../../src/generators/TypeORMGenerator';
import { PrismaGenerator } from '../../../src/generators/PrismaGenerator';
import { DatabaseSchema } from '../../../src/types/introspection';

describe('Model Defaults', () => {
  const schema: DatabaseSchema = {
    tables: [
      {
        name: 'Teste',
        columns: [
          {
            name: 'STATUS',
            dataType: 'smallint',
            isPrimaryKey: false,
            isAutoIncrement: false,
            isNullable: false,
            hasDefault: true,
            defaultValue: 'CREATE DEFAULT DEF_DLOGICNULL AS 0\r\nFOR [STATUS]',
            isUnique: false,
          },
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

  it('should normalize defaults in Sequelize models', async () => {
    const generator = new SequelizeGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).toContain('defaultValue: 0');
    expect(model.content).toContain('defaultValue: "guest"');
    expect(model.content).toContain('defaultValue: Sequelize.literal("getdate()")');
    expect(model.content).not.toContain('CREATE DEFAULT DEF_DLOGICNULL AS 0');
  });

  it('should normalize defaults in TypeORM models', async () => {
    const generator = new TypeORMGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).toContain('default: 0');
    expect(model.content).toContain('default: "guest"');
    expect(model.content).toContain('default: () => "getdate()"');
    expect(model.content).not.toContain('CREATE DEFAULT DEF_DLOGICNULL AS 0');
  });

  it('should normalize defaults in Prisma models', async () => {
    const generator = new PrismaGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).toContain('STATUS Int @default(0)');
    expect(model.content).toContain('NOME String @default("guest")');
    expect(model.content).toContain('CRIADOEM DateTime @default(now())');
    expect(model.content).not.toContain('CREATE DEFAULT DEF_DLOGICNULL AS 0');
  });
});

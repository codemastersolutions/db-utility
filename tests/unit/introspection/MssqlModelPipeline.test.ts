import { describe, expect, it, vi } from 'vitest';
import { MongooseGenerator } from '../../../src/generators/MongooseGenerator';
import { PrismaGenerator } from '../../../src/generators/PrismaGenerator';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { TypeORMGenerator } from '../../../src/generators/TypeORMGenerator';
import { IntrospectionService } from '../../../src/introspection/IntrospectionService';
import { IDatabaseConnector } from '../../../src/types/database';

describe('MSSQL Model Pipeline', () => {
  const createConnector = (): IDatabaseConnector => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(),
    getVersion: vi.fn(),
    query: vi
      .fn()
      .mockResolvedValueOnce([{ table_name: 'GFORMULA' }])
      .mockResolvedValueOnce([
        {
          table_name: 'GFORMULA',
          column_name: 'STATUS',
          data_type: 'smallint',
          is_nullable: 'NO',
          column_default: 'CREATE DEFAULT DEF_DLOGICONULL AS 0\r\nFOR [STATUS]',
          character_maximum_length: null,
          numeric_precision: 5,
          numeric_scale: 0,
          is_identity: 0,
        },
        {
          table_name: 'GFORMULA',
          column_name: 'NOME',
          data_type: 'nvarchar',
          is_nullable: 'NO',
          column_default: "(N'guest')",
          character_maximum_length: 100,
          numeric_precision: null,
          numeric_scale: null,
          is_identity: 0,
        },
        {
          table_name: 'GFORMULA',
          column_name: 'CRIADOEM',
          data_type: 'datetime',
          is_nullable: 'YES',
          column_default: '(getdate())',
          character_maximum_length: null,
          numeric_precision: null,
          numeric_scale: null,
          is_identity: 0,
        },
        {
          table_name: 'GFORMULA',
          column_name: 'DATAFECHAMENTOFACTOR',
          data_type: 'datetimeoffset',
          is_nullable: 'YES',
          column_default: '((0))',
          character_maximum_length: null,
          numeric_precision: null,
          numeric_scale: null,
          is_identity: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]),
  });

  it('should normalize legacy MSSQL defaults before generating Sequelize models', async () => {
    const service = new IntrospectionService(createConnector(), { type: 'mssql' });
    const schema = await service.introspect();
    const generator = new SequelizeGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).toContain('defaultValue: 0');
    expect(model.content).toContain('defaultValue: "guest"');
    expect(model.content).toContain('defaultValue: Sequelize.literal("getdate()")');
    expect(model.content).not.toContain('CREATE DEFAULT DEF_DLOGICONULL AS 0');
    expect(model.content).toContain('DATAFECHAMENTOFACTOR');
    expect(model.content).not.toContain('DATAFECHAMENTOFACTOR: {\n      type: DataTypes.DATE,\n      defaultValue: 0');
  });

  it('should normalize legacy MSSQL defaults before generating TypeORM models', async () => {
    const service = new IntrospectionService(createConnector(), { type: 'mssql' });
    const schema = await service.introspect();
    const generator = new TypeORMGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).toContain('default: 0');
    expect(model.content).toContain('default: "guest"');
    expect(model.content).toContain('default: () => "getdate()"');
    expect(model.content).not.toContain('CREATE DEFAULT DEF_DLOGICONULL AS 0');
    expect(model.content).toContain(
      "@Column({ type: 'datetimeoffset', nullable: true })\n  DATAFECHAMENTOFACTOR?: Date;",
    );
    expect(model.content).not.toContain(
      "@Column({ type: 'datetimeoffset', nullable: true, default: 0 })\n  DATAFECHAMENTOFACTOR?: Date;",
    );
  });

  it('should normalize legacy MSSQL defaults before generating Mongoose models', async () => {
    const service = new IntrospectionService(createConnector(), { type: 'mssql' });
    const schema = await service.introspect();
    const generator = new MongooseGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).toContain('default: 0');
    expect(model.content).toContain('default: "guest"');
    expect(model.content).toContain('default: Date.now');
    expect(model.content).not.toContain('CREATE DEFAULT DEF_DLOGICONULL AS 0');
    expect(model.content).toContain('DATAFECHAMENTOFACTOR: {\n    type: Date\n  }');
    expect(model.content).not.toContain(
      'DATAFECHAMENTOFACTOR: {\n    type: Date,\n    default: 0\n  }',
    );
  });

  it('should normalize legacy MSSQL defaults before generating Prisma models', async () => {
    const service = new IntrospectionService(createConnector(), { type: 'mssql' });
    const schema = await service.introspect();
    const generator = new PrismaGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).toContain('STATUS Int @default(0)');
    expect(model.content).toContain('NOME String @default("guest")');
    expect(model.content).toContain('CRIADOEM DateTime? @default(now())');
    expect(model.content).not.toContain('CREATE DEFAULT DEF_DLOGICONULL AS 0');
    expect(model.content).toContain('DATAFECHAMENTOFACTOR DateTime?');
    expect(model.content).not.toContain('DATAFECHAMENTOFACTOR DateTime? @default(0)');
  });
});

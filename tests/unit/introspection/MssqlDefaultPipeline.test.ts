import { describe, expect, it, vi } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { TypeORMGenerator } from '../../../src/generators/TypeORMGenerator';
import { IntrospectionService } from '../../../src/introspection/IntrospectionService';
import { IDatabaseConnector } from '../../../src/types/database';

describe('MSSQL Default Pipeline', () => {
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
          column_name: 'INDSELECAO',
          data_type: 'smallint',
          is_nullable: 'NO',
          column_default: 'CREATE DEFAULT DEF_DLOGICONULL AS 0\r\nFOR [INDSELECAO]',
          character_maximum_length: null,
          numeric_precision: 5,
          numeric_scale: 0,
          is_identity: 0,
        },
        {
          table_name: 'GFORMULA',
          column_name: 'COMPATIBILIDADEWIN32',
          data_type: 'smallint',
          is_nullable: 'YES',
          column_default: 'CREATE DEFAULT DEF_DLOGICONULL AS ((0))\r\nFOR [COMPATIBILIDADEWIN32]',
          character_maximum_length: null,
          numeric_precision: 5,
          numeric_scale: 0,
          is_identity: 0,
        },
        {
          table_name: 'GFORMULA',
          column_name: 'ULTALTDATA',
          data_type: 'datetime',
          is_nullable: 'YES',
          column_default: '(getdate())',
          character_maximum_length: null,
          numeric_precision: null,
          numeric_scale: null,
          is_identity: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          table_name: 'GFORMULA',
          index_name: 'PKGFORMULA',
          is_unique: true,
          is_primary: true,
          column_name: 'INDSELECAO',
          key_ordinal: 1,
        },
      ])
      .mockResolvedValueOnce([]),
  });

  it('should normalize legacy MSSQL defaults before generating Sequelize migrations', async () => {
    const service = new IntrospectionService(createConnector(), { type: 'mssql' });
    const schema = await service.introspect();
    const generator = new SequelizeGenerator();
    const [migration] = await generator.generateMigrations(schema);

    expect(migration.content).toContain('defaultValue: 0');
    expect(migration.content).toContain('defaultValue: Sequelize.literal("getdate()")');
    expect(migration.content).not.toContain('CREATE DEFAULT DEF_DLOGICONULL AS 0');
  });

  it('should normalize legacy MSSQL defaults before generating TypeORM migrations', async () => {
    const service = new IntrospectionService(createConnector(), { type: 'mssql' });
    const schema = await service.introspect();
    const generator = new TypeORMGenerator();
    const [migration] = await generator.generateMigrations(schema);

    expect(migration.content).toContain('default: 0');
    expect(migration.content).toContain('default: () => "getdate()"');
    expect(migration.content).not.toContain('CREATE DEFAULT DEF_DLOGICONULL AS 0');
  });
});

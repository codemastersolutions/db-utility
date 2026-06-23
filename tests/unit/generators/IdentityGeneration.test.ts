import { describe, it, expect } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { TypeORMGenerator } from '../../../src/generators/TypeORMGenerator';
import { DatabaseSchema, TableData } from '../../../src/types/introspection';

describe('Identity Generation', () => {
  const mockSchema: DatabaseSchema = {
    tables: [
      {
        name: 'Users',
        columns: [
          {
            name: 'id',
            dataType: 'int',
            isPrimaryKey: true,
            isAutoIncrement: true,
            isNullable: false,
            hasDefault: false,
            isUnique: true,
          },
          {
            name: 'name',
            dataType: 'varchar',
            isPrimaryKey: false,
            isAutoIncrement: false,
            isNullable: false,
            hasDefault: false,
            isUnique: false,
          },
        ],
        indexes: [{ name: 'pk_users', columns: ['id'], isPrimary: true, isUnique: true }],
        foreignKeys: [],
      },
    ],
  };

  const mockData: TableData[] = [
    {
      tableName: 'Users',
      columns: mockSchema.tables[0].columns,
      rows: [{ id: 1, name: 'Alice' }],
      disableIdentity: true,
    },
  ];

  it('SequelizeGenerator should generate seed migration with identity handling when disableIdentity is true', async () => {
    const generator = new SequelizeGenerator();
    const files = await generator.generateDataMigrations(mockData);

    expect(files.length).toBe(1);

    const seedContent = files[0].content;
    expect(files[0].fileName).toContain('seed-Users.js');
    expect(seedContent).toContain('const dialect = queryInterface.sequelize.getDialect();');
    expect(seedContent).toContain("if (dialect === 'mssql')");
    expect(seedContent).toContain('SET IDENTITY_INSERT [dbo].[Users] ON;');
    expect(seedContent).toContain('SET IDENTITY_INSERT [dbo].[Users] OFF;');
  });

  it('SequelizeGenerator should preserve MSSQL identity handling in interleaved migrations', async () => {
    const generator = new SequelizeGenerator();
    const files = await generator.generateMigrations(mockSchema, mockData);

    const seedFile = files.find((file) => file.fileName.includes('seed-Users.js'));

    expect(seedFile).toBeDefined();
    expect(seedFile?.content).toContain('SET IDENTITY_INSERT [dbo].[Users] ON;');
    expect(seedFile?.content).toContain('SET IDENTITY_INSERT [dbo].[Users] OFF;');
  });

  it('SequelizeGenerator should revive Buffer values in seed migrations', async () => {
    const generator = new SequelizeGenerator();
    const files = await generator.generateDataMigrations([
      {
        tableName: 'Users',
        columns: [
          ...mockSchema.tables[0].columns,
          {
            name: 'avatar',
            dataType: 'image',
            isPrimaryKey: false,
            isAutoIncrement: false,
            isNullable: true,
            hasDefault: false,
            isUnique: false,
          },
        ],
        rows: [{ name: 'Alice', avatar: Buffer.from([1, 2, 3]) }],
      },
    ]);

    const seedContent = files[0].content;

    expect(seedContent).toContain('function reviveSeedValue(value)');
    expect(seedContent).toContain('const data = reviveSeedRows([');
    expect(seedContent).toContain('"type": "Buffer"');
    expect(seedContent).toContain('return Buffer.from(value.data);');
  });

  it('SequelizeGenerator should emit hex literals for Buffer values in MSSQL identity batches', async () => {
    const generator = new SequelizeGenerator();
    const files = await generator.generateDataMigrations([
      {
        tableName: 'Users',
        columns: [
          ...mockSchema.tables[0].columns,
          {
            name: 'avatar',
            dataType: 'image',
            isPrimaryKey: false,
            isAutoIncrement: false,
            isNullable: true,
            hasDefault: false,
            isUnique: false,
          },
        ],
        rows: [{ id: 1, name: 'Alice', avatar: Buffer.from([1, 2, 3]) }],
        disableIdentity: true,
      },
    ]);

    const seedContent = files[0].content;

    expect(seedContent).toContain('0x010203');
  });

  it('TypeORMGenerator should include identity reset for Postgres when disableIdentity is true', async () => {
    const generator = new TypeORMGenerator();
    const files = await generator.generateDataMigrations(mockData);

    const content = files[0].content;
    expect(content).toContain("queryRunner.connection.driver.options.type === 'postgres'");
    expect(content).toContain(
      String.raw`SELECT setval(pg_get_serial_sequence(\'"Users"\', \'id\'), MAX("id")) FROM "Users"`,
    );
  });
});

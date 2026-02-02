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

  it('SequelizeGenerator should include identity reset for Postgres when disableIdentity is true', async () => {
    const generator = new SequelizeGenerator();
    const files = await generator.generateDataMigrations(mockData);

    const content = files[0].content;
    expect(content).toContain("dialect === 'postgres'");
    // Adjusted expectation to match generated code: quoted table and column names
    expect(content).toContain(
      'SELECT setval(pg_get_serial_sequence(\\\'"Users"\\\', \\\'id\\\'), MAX("id")) FROM "Users"',
    );
  });

  it('TypeORMGenerator should include identity reset for Postgres when disableIdentity is true', async () => {
    const generator = new TypeORMGenerator();
    const files = await generator.generateDataMigrations(mockData);

    const content = files[0].content;
    expect(content).toContain("queryRunner.connection.driver.options.type === 'postgres'");
    // Adjusted expectation to match generated code
    expect(content).toContain(
      'SELECT setval(pg_get_serial_sequence(\\\'"Users"\\\', \\\'id\\\'), MAX("id")) FROM "Users"',
    );
  });

  it('SequelizeGenerator should include identity insert for MSSQL when disableIdentity is true', async () => {
    const generator = new SequelizeGenerator();
    const files = await generator.generateDataMigrations(mockData);

    const content = files[0].content;
    expect(content).toContain("dialect === 'mssql'");
    expect(content).toContain('SET IDENTITY_INSERT "Users" ON');
    expect(content).toContain('SET IDENTITY_INSERT "Users" OFF');
  });
});

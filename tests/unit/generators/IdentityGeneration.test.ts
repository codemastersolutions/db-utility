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

  it('SequelizeGenerator should generate separate Enable Identity migration when disableIdentity is true', async () => {
    const generator = new SequelizeGenerator();
    const files = await generator.generateDataMigrations(mockData);

    // Should have 2 files: Seed and EnableIdentity
    expect(files.length).toBe(2);

    // Check Seed File
    const seedContent = files[0].content;
    expect(files[0].fileName).toContain('seed-Users.js');
    expect(seedContent).not.toContain('SET IDENTITY_INSERT'); // Should NOT have identity insert
    expect(seedContent).not.toContain('setval'); // Should NOT have setval

    // Check Enable Identity File
    const enableIdentityContent = files[1].content;
    expect(files[1].fileName).toContain('enable-identity-Users.js');
    expect(enableIdentityContent).toContain("dialect === 'postgres'");
    expect(enableIdentityContent).toContain('changeColumn');
    expect(enableIdentityContent).toContain('SELECT setval');
  });

  it('TypeORMGenerator should include identity reset for Postgres when disableIdentity is true', async () => {
    const generator = new TypeORMGenerator();
    const files = await generator.generateDataMigrations(mockData);

    const content = files[0].content;
    expect(content).toContain("queryRunner.connection.driver.options.type === 'postgres'");
    expect(content).toContain(
      'SELECT setval(pg_get_serial_sequence(\\\'"Users"\\\', \\\'id\\\'), MAX("id")) FROM "Users"',
    );
  });
});

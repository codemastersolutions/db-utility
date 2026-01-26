import { describe, it, expect } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { TypeORMGenerator } from '../../../src/generators/TypeORMGenerator';
import { DatabaseSchema, TableData } from '../../../src/types/introspection';

describe('Interleaved Generation', () => {
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
      {
        name: 'Posts',
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
            name: 'title',
            dataType: 'varchar',
            isPrimaryKey: false,
            isAutoIncrement: false,
            isNullable: false,
            hasDefault: false,
            isUnique: false,
          },
          {
            name: 'userId',
            dataType: 'int',
            isPrimaryKey: false,
            isAutoIncrement: false,
            isNullable: false,
            hasDefault: false,
            isUnique: false,
          },
        ],
        indexes: [{ name: 'pk_posts', columns: ['id'], isPrimary: true, isUnique: true }],
        foreignKeys: [
          {
            name: 'fk_posts_users',
            tableName: 'Posts',
            columns: ['userId'],
            referencedTable: 'Users',
            referencedColumns: ['id'],
          },
        ],
      },
    ],
  };

  const mockData: TableData[] = [
    {
      tableName: 'Users',
      columns: mockSchema.tables[0].columns,
      rows: [{ id: 1, name: 'Alice' }],
    },
    // No data for Posts to test partial seeding
  ];

  it('SequelizeGenerator should interleave seeds', async () => {
    const generator = new SequelizeGenerator();
    const files = await generator.generateMigrations(mockSchema, mockData);

    // Expected order:
    // 1. Create Users
    // 2. Seed Users
    // 3. Create Posts
    // 4. Add FKs Posts
    // (No seed for Posts)

    expect(files).toHaveLength(4);

    // Sort by filename to check order
    const sortedFiles = files.sort((a, b) => a.fileName.localeCompare(b.fileName));

    expect(sortedFiles[0].fileName).toContain('create-Users');
    expect(sortedFiles[1].fileName).toContain('seed-Users');
    expect(sortedFiles[2].fileName).toContain('create-Posts');
    expect(sortedFiles[3].fileName).toContain('add-fks-Posts');

    // Verify content logic (briefly)
    expect(sortedFiles[1].content).toContain('bulkInsert');
    expect(sortedFiles[1].content).toContain('Alice');
  });

  it('TypeORMGenerator should interleave seeds', async () => {
    const generator = new TypeORMGenerator();
    const files = await generator.generateMigrations(mockSchema, mockData);

    // Expected order:
    // 1. CreateUsers
    // 2. SeedUsers
    // 3. CreatePosts

    expect(files).toHaveLength(3);

    // TypeORM filenames use timestamps, check logical ordering by sorting
    const sortedFiles = files.sort((a, b) => {
      // Filenames are like {timestamp}-{name}.ts
      const tA = parseInt(a.fileName.split('-')[0]);
      const tB = parseInt(b.fileName.split('-')[0]);
      return tA - tB;
    });

    expect(sortedFiles[0].fileName).toContain('CreateUsers');
    expect(sortedFiles[1].fileName).toContain('SeedUsers');
    expect(sortedFiles[2].fileName).toContain('CreatePosts');

    expect(sortedFiles[1].content).toContain('Alice');
  });

  it('should handle case-insensitive table matching', async () => {
    const dataWithDifferentCase: TableData[] = [
      {
        tableName: 'users', // lowercase
        columns: mockSchema.tables[0].columns,
        rows: [{ id: 1, name: 'Bob' }],
      },
    ];

    const generator = new SequelizeGenerator();
    const files = await generator.generateMigrations(mockSchema, dataWithDifferentCase);

    const seedFile = files.find((f) => f.fileName.includes('seed-Users'));
    expect(seedFile).toBeDefined();
    expect(seedFile?.content).toContain('Bob');
  });
});

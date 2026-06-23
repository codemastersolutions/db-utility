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

  it('SequelizeGenerator should create tables before seeds and foreign keys', async () => {
    const generator = new SequelizeGenerator();
    const files = await generator.generateMigrations(mockSchema, mockData);

    // Expected order:
    // 1. Create Users
    // 2. Create Posts
    // 3. Seed Users
    // 4. Add FKs Posts

    expect(files).toHaveLength(4);

    // Sort by filename to check order
    const sortedFiles = files.toSorted((a, b) => a.fileName.localeCompare(b.fileName));

    expect(sortedFiles[0].fileName).toContain('create-Users');
    expect(sortedFiles[1].fileName).toContain('create-Posts');
    expect(sortedFiles[2].fileName).toContain('seed-Users');
    expect(sortedFiles[3].fileName).toContain('add-fks-Posts');

    // Verify content logic (briefly)
    expect(sortedFiles[2].content).toContain('bulkInsert');
    expect(sortedFiles[2].content).toContain('Alice');
    // Auto-increment column 'id' should be filtered out
    expect(sortedFiles[2].content).not.toContain('"id": 1');
  });

  it('TypeORMGenerator should create tables before seeds and foreign keys', async () => {
    const generator = new TypeORMGenerator();
    const files = await generator.generateMigrations(mockSchema, mockData);

    // Expected order:
    // 1. CreateUsers
    // 2. CreatePosts
    // 3. SeedUsers
    // 4. AddFksPosts

    expect(files).toHaveLength(4);

    // TypeORM filenames use timestamps, check logical ordering by sorting
    const sortedFiles = files.toSorted((a, b) => {
      // Filenames are like {timestamp}-{name}.ts
      const tA = Number.parseInt(a.fileName.split('-')[0]);
      const tB = Number.parseInt(b.fileName.split('-')[0]);
      return tA - tB;
    });

    expect(sortedFiles[0].fileName).toContain('CreateUsers');
    expect(sortedFiles[1].fileName).toContain('CreatePosts');
    expect(sortedFiles[2].fileName).toContain('SeedUsers');
    expect(sortedFiles[3].fileName).toContain('AddFksPosts');

    expect(sortedFiles[2].content).toContain('Alice');
    // Auto-increment column 'id' should be filtered out
    expect(sortedFiles[2].content).not.toContain('"id": 1');
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

  it('SequelizeGenerator should skip foreign key files when disabled', async () => {
    const generator = new SequelizeGenerator();
    const files = await generator.generateMigrations(mockSchema, mockData, {
      disableForeignKeys: true,
    });

    expect(files).toHaveLength(3);
    expect(files.some((file) => file.fileName.includes('add-fks'))).toBe(false);
  });

  it('TypeORMGenerator should skip foreign key files when disabled', async () => {
    const generator = new TypeORMGenerator();
    const files = await generator.generateMigrations(mockSchema, mockData, {
      disableForeignKeys: true,
    });

    expect(files).toHaveLength(3);
    expect(files.some((file) => file.fileName.includes('AddFks'))).toBe(false);
  });
});

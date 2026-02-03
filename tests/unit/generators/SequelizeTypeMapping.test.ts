import { describe, it, expect } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { ColumnMetadata, DatabaseSchema } from '../../../src/types/introspection';

describe('SequelizeGenerator Type Mapping', () => {
  const generator = new SequelizeGenerator();

  // Helper to access private mapType method (via type assertion or by testing public method that uses it)
  // Since mapType is private, we'll test generateColumnDefinition or generateMigrationColumn logic
  // But generateMigrationColumn is private too.
  // We'll test 'generate' or 'generateMigrations' output.

  const createSchema = (col: ColumnMetadata): DatabaseSchema => ({
    tables: [
      {
        name: 'TestTable',
        columns: [col],
        indexes: [],
        foreignKeys: [],
      },
    ],
  });

  it('should map varchar(max) to DataTypes.TEXT', async () => {
    const col: ColumnMetadata = {
      name: 'description',
      dataType: 'varchar',
      maxLength: -1, // MAX
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generate(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('description: {');
    expect(content).toContain('type: DataTypes.TEXT');
  });

  it('should map varchar(100) to DataTypes.STRING(100)', async () => {
    const col: ColumnMetadata = {
      name: 'title',
      dataType: 'varchar',
      maxLength: 100,
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generate(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('title: {');
    expect(content).toContain('type: DataTypes.STRING(100)');
  });

  it('should map text to DataTypes.TEXT', async () => {
    const col: ColumnMetadata = {
      name: 'content',
      dataType: 'text',
      maxLength: 2147483647, // often ignored for text type itself
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generate(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('content: {');
    expect(content).toContain('type: DataTypes.TEXT');
  });

  it('should map decimal(10, 2) correctly', async () => {
    const col: ColumnMetadata = {
      name: 'price',
      dataType: 'decimal',
      numericPrecision: 10,
      numericScale: 2,
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generate(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('price: {');
    expect(content).toContain('type: DataTypes.DECIMAL(10, 2)');
  });

  it('should map bit to DataTypes.BOOLEAN', async () => {
    const col: ColumnMetadata = {
      name: 'isActive',
      dataType: 'bit',
      isNullable: false,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generate(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('isActive: {');
    expect(content).toContain('type: DataTypes.BOOLEAN');
  });
});

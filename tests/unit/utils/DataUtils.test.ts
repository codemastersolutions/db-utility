import { describe, it, expect } from 'vitest';
import { filterAutoIncrementColumns } from '../../../src/utils/DataUtils';
import { TableData } from '../../../src/types/introspection';

describe('DataUtils', () => {
  it('should filter out auto-increment columns', () => {
    const tableData: TableData = {
      tableName: 'Users',
      columns: [
        {
          name: 'id',
          dataType: 'int',
          isPrimaryKey: true,
          isAutoIncrement: true,
          isNullable: false,
          hasDefault: false,
          defaultValue: null,
          isUnique: true,
          maxLength: null,
          numericPrecision: null,
          numericScale: null,
        },
        {
          name: 'name',
          dataType: 'varchar',
          isPrimaryKey: false,
          isAutoIncrement: false,
          isNullable: false,
          hasDefault: false,
          defaultValue: null,
          isUnique: false,
          maxLength: 255,
          numericPrecision: null,
          numericScale: null,
        },
      ],
      rows: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
    };

    const result = filterAutoIncrementColumns(tableData);

    expect(result).toHaveLength(2);
    expect(result[0]).not.toHaveProperty('id');
    expect(result[0]).toHaveProperty('name', 'Alice');
    expect(result[1]).not.toHaveProperty('id');
    expect(result[1]).toHaveProperty('name', 'Bob');
  });

  it('should return rows as is if no auto-increment column exists', () => {
    const tableData: TableData = {
      tableName: 'Settings',
      columns: [
        {
          name: 'key',
          dataType: 'varchar',
          isPrimaryKey: true,
          isAutoIncrement: false,
          isNullable: false,
          hasDefault: false,
          defaultValue: null,
          isUnique: true,
          maxLength: 255,
          numericPrecision: null,
          numericScale: null,
        },
        {
          name: 'value',
          dataType: 'varchar',
          isPrimaryKey: false,
          isAutoIncrement: false,
          isNullable: false,
          hasDefault: false,
          defaultValue: null,
          isUnique: false,
          maxLength: 255,
          numericPrecision: null,
          numericScale: null,
        },
      ],
      rows: [{ key: 'theme', value: 'dark' }],
    };

    const result = filterAutoIncrementColumns(tableData);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ key: 'theme', value: 'dark' });
  });

  it('should handle rows without the auto-increment key gracefully', () => {
    const tableData: TableData = {
      tableName: 'Users',
      columns: [
        {
          name: 'id',
          dataType: 'int',
          isPrimaryKey: true,
          isAutoIncrement: true,
          isNullable: false,
          hasDefault: false,
          defaultValue: null,
          isUnique: true,
          maxLength: null,
          numericPrecision: null,
          numericScale: null,
        },
        {
          name: 'name',
          dataType: 'varchar',
          isPrimaryKey: false,
          isAutoIncrement: false,
          isNullable: false,
          hasDefault: false,
          defaultValue: null,
          isUnique: false,
          maxLength: 255,
          numericPrecision: null,
          numericScale: null,
        },
      ],
      rows: [
        { name: 'Charlie' }, // id missing
      ],
    };

    const result = filterAutoIncrementColumns(tableData);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Charlie' });
  });

  it('should not filter auto-increment columns if disableIdentity is true', () => {
    const tableData: TableData = {
      tableName: 'Users',
      disableIdentity: true,
      columns: [
        {
          name: 'id',
          dataType: 'int',
          isPrimaryKey: true,
          isAutoIncrement: true,
          isNullable: false,
          hasDefault: false,
          defaultValue: null,
          isUnique: true,
          maxLength: null,
          numericPrecision: null,
          numericScale: null,
        },
        {
          name: 'name',
          dataType: 'varchar',
          isPrimaryKey: false,
          isAutoIncrement: false,
          isNullable: false,
          hasDefault: false,
          defaultValue: null,
          isUnique: false,
          maxLength: 255,
          numericPrecision: null,
          numericScale: null,
        },
      ],
      rows: [{ id: 1, name: 'Alice' }],
    };

    const result = filterAutoIncrementColumns(tableData);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('id', 1);
    expect(result[0]).toHaveProperty('name', 'Alice');
  });
});

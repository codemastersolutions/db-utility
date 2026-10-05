import { describe, expect, it } from 'vitest';
import { ColumnMetadata, IndexMetadata } from '../../../src/types/introspection';
import {
  getGeneratableIndexes,
  getGeneratableIndexesDetailed,
  isMssqlIndexableKeyColumn,
} from '../../../src/utils/IndexUtils';

const baseColumn = (
  overrides: Partial<ColumnMetadata> & { name: string; dataType: string },
): ColumnMetadata => ({
  isNullable: true,
  hasDefault: false,
  defaultValue: null,
  isPrimaryKey: false,
  isUnique: false,
  isAutoIncrement: false,
  maxLength: null,
  numericPrecision: null,
  numericScale: null,
  ...overrides,
});

const baseIndex = (overrides: Partial<IndexMetadata>): IndexMetadata => ({
  name: 'IX_test',
  columns: ['col'],
  isUnique: false,
  isPrimary: false,
  ...overrides,
});

describe('IndexUtils - MSSQL non-indexable key types', () => {
  const columns: ColumnMetadata[] = [
    baseColumn({ name: 'Id', dataType: 'int', isPrimaryKey: true, isNullable: false }),
    baseColumn({ name: 'ChaveLinha', dataType: 'varchar', maxLength: -1 }),
    baseColumn({
      name: 'HashBin',
      dataType: 'varbinary',
      maxLength: null,
      effectiveMaxLength: -1,
    }),
    baseColumn({ name: 'BinUnknown', dataType: 'varbinary' }),
    baseColumn({ name: 'Descricao', dataType: 'text' }),
    baseColumn({ name: 'Payload', dataType: 'xml' }),
    baseColumn({ name: 'GeometryCol', dataType: 'geometry' }),
    baseColumn({ name: 'Status', dataType: 'nvarchar', maxLength: 50 }),
  ];

  const indexes: IndexMetadata[] = [
    baseIndex({ name: 'PK_Id', columns: ['Id'], isPrimary: true }),
    baseIndex({ name: 'IX_ChaveLinha', columns: ['ChaveLinha'] }),
    baseIndex({ name: 'IX_HashBin', columns: ['HashBin'] }),
    baseIndex({ name: 'IX_BinUnknown', columns: ['BinUnknown'] }),
    baseIndex({ name: 'IX_Descricao', columns: ['Descricao'] }),
    baseIndex({ name: 'IX_Geometry', columns: ['GeometryCol'] }),
    baseIndex({ name: 'IX_Status', columns: ['Status'] }),
    baseIndex({
      name: 'IX_ChaveLinha_Status',
      columns: ['ChaveLinha', 'Status'],
    }),
  ];

  it('isMssqlIndexableKeyColumn rejects varchar(max), varbinary(max), text, xml, geometry', () => {
    expect(isMssqlIndexableKeyColumn(columns[1]!)).toBe(false);
    expect(isMssqlIndexableKeyColumn(columns[2]!)).toBe(false);
    expect(isMssqlIndexableKeyColumn(columns[3]!)).toBe(false);
    expect(isMssqlIndexableKeyColumn(columns[4]!)).toBe(false);
    expect(isMssqlIndexableKeyColumn(columns[5]!)).toBe(false);
    expect(isMssqlIndexableKeyColumn(columns[6]!)).toBe(false);
  });

  it('isMssqlIndexableKeyColumn accepts bounded nvarchar', () => {
    expect(isMssqlIndexableKeyColumn(columns[7]!)).toBe(true);
  });

  it('drops indexes whose key columns are non-indexable on MSSQL', () => {
    const result = getGeneratableIndexesDetailed(indexes, columns, { databaseType: 'mssql' });
    const names = result.kept.map((idx) => idx.name);

    expect(names).toContain('PK_Id');
    expect(names).toContain('IX_Status');
    expect(names).not.toContain('IX_ChaveLinha');
    expect(names).not.toContain('IX_HashBin');
    expect(names).not.toContain('IX_BinUnknown');
    expect(names).not.toContain('IX_Descricao');
    expect(names).not.toContain('IX_Geometry');
    expect(names).not.toContain('IX_ChaveLinha_Status');

    const droppedNames = result.dropped.map((d) => d.indexName);
    expect(droppedNames).toContain('IX_ChaveLinha');
    expect(droppedNames).toContain('IX_HashBin');
    expect(droppedNames).toContain('IX_BinUnknown');
  });

  it('keeps non-indexable indexes when databaseType is not MSSQL', () => {
    const result = getGeneratableIndexesDetailed(indexes, columns, { databaseType: 'postgres' });
    const names = result.kept.map((idx) => idx.name);

    expect(names).toContain('IX_ChaveLinha');
    expect(names).toContain('IX_HashBin');
    expect(names).toContain('IX_Descricao');
    expect(names).toContain('IX_Geometry');
    expect(result.dropped).toHaveLength(0);
  });

  it('preserves backward compatibility when columns are omitted', () => {
    const result = getGeneratableIndexes(indexes);
    expect(result).toHaveLength(indexes.length);
  });

  it('still enforces the 32-key-column cap on MSSQL', () => {
    const oversizedIndex = baseIndex({
      name: 'IX_Wide',
      columns: Array.from({ length: 33 }, (_, i) => `col${i}`),
    });
    const result = getGeneratableIndexesDetailed([oversizedIndex], [], { databaseType: 'mssql' });
    expect(result.kept).toHaveLength(0);
    expect(result.dropped[0]?.reason).toBe('too-many-key-columns');
  });
});

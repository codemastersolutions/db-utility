import { ColumnMetadata, DatabaseSchema, IndexMetadata } from '../types/introspection';
import { DatabaseType } from '../types/database';
import { getEffectiveDataType } from './ColumnTypeUtils';

export const INDEX_KEY_COLUMN_LIMIT = 32;

export interface WideTableInfo {
  tableName: string;
  columnCount: number;
}

export interface OversizedIndexInfo {
  tableName: string;
  indexName: string;
  keyColumnCount: number;
  columns: string[];
}

export interface DroppedIndexInfo {
  indexName: string;
  reason: 'too-many-key-columns' | 'non-indexable-key-column' | 'missing-key-column';
  columns: string[];
}

export interface GeneratableIndexesResult {
  kept: IndexMetadata[];
  dropped: DroppedIndexInfo[];
}

export interface SchemaLimitAnalysis {
  tablesOverColumnLimit: WideTableInfo[];
  indexesOverKeyColumnLimit: OversizedIndexInfo[];
}

export interface GetGeneratableIndexesOptions {
  maxKeyColumns?: number;
  databaseType?: DatabaseType;
}

const MSSQL_NON_INDEXABLE_KEY_TYPES: ReadonlySet<string> = new Set([
  'text',
  'ntext',
  'image',
  'xml',
  'geography',
  'geometry',
  'hierarchyid',
  'rowversion',
  'timestamp',
  'sql_variant',
  'vector',
  'blob',
  'binary varying',
]);

const MSSQL_LENGTH_BOUNDED_TYPES: ReadonlySet<string> = new Set([
  'varchar',
  'nvarchar',
  'varbinary',
  'char',
  'nchar',
  'binary',
]);

function normalizeDataType(dataType: string): string {
  return dataType
    .toLowerCase()
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();
}

export function isMssqlIndexableKeyColumn(column: ColumnMetadata): boolean {
  const baseType = normalizeDataType(getEffectiveDataType(column));
  if (MSSQL_NON_INDEXABLE_KEY_TYPES.has(baseType)) {
    return false;
  }

  const maxLength = column.effectiveMaxLength ?? column.maxLength;
  if (MSSQL_LENGTH_BOUNDED_TYPES.has(baseType)) {
    if (maxLength === -1 || maxLength === null || maxLength === undefined) {
      return false;
    }
  }

  return true;
}

export function getGeneratableIndexes(
  indexes: IndexMetadata[],
  columns: ColumnMetadata[] = [],
  options: GetGeneratableIndexesOptions = {},
): IndexMetadata[] {
  return getGeneratableIndexesDetailed(indexes, columns, options).kept;
}

export function getGeneratableIndexesDetailed(
  indexes: IndexMetadata[],
  columns: ColumnMetadata[] = [],
  options: GetGeneratableIndexesOptions = {},
): GeneratableIndexesResult {
  const maxKeyColumns = options.maxKeyColumns ?? INDEX_KEY_COLUMN_LIMIT;
  const enforceMssqlKeyTypes = options.databaseType === 'mssql';

  const lookup = new Map(columns.map((c) => [c.name.toLowerCase(), c]));

  const kept: IndexMetadata[] = [];
  const dropped: DroppedIndexInfo[] = [];

  for (const index of indexes) {
    if (index.columns.length === 0) {
      dropped.push({
        indexName: index.name,
        reason: 'missing-key-column',
        columns: index.columns,
      });
      continue;
    }

    if (index.columns.length > maxKeyColumns) {
      dropped.push({
        indexName: index.name,
        reason: 'too-many-key-columns',
        columns: index.columns,
      });
      continue;
    }

    if (enforceMssqlKeyTypes) {
      let blocked = false;
      for (const columnName of index.columns) {
        const column = lookup.get(columnName.toLowerCase());
        if (!column || !isMssqlIndexableKeyColumn(column)) {
          dropped.push({
            indexName: index.name,
            reason: 'non-indexable-key-column',
            columns: index.columns,
          });
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
    }

    kept.push(index);
  }

  return { kept, dropped };
}

export function analyzeSchemaLimits(
  schema: DatabaseSchema,
  maxKeyColumns = INDEX_KEY_COLUMN_LIMIT,
): SchemaLimitAnalysis {
  return {
    tablesOverColumnLimit: schema.tables
      .filter((table) => table.columns.length > maxKeyColumns)
      .map((table) => ({
        tableName: table.name,
        columnCount: table.columns.length,
      })),
    indexesOverKeyColumnLimit: schema.tables.flatMap((table) =>
      table.indexes
        .filter((index) => index.columns.length > maxKeyColumns)
        .map((index) => ({
          tableName: table.name,
          indexName: index.name,
          keyColumnCount: index.columns.length,
          columns: index.columns,
        })),
    ),
  };
}

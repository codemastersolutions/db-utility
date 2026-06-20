import { DatabaseSchema, IndexMetadata } from '../types/introspection';

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

export interface SchemaLimitAnalysis {
  tablesOverColumnLimit: WideTableInfo[];
  indexesOverKeyColumnLimit: OversizedIndexInfo[];
}

export function getGeneratableIndexes(
  indexes: IndexMetadata[],
  maxKeyColumns = INDEX_KEY_COLUMN_LIMIT,
): IndexMetadata[] {
  return indexes.filter((index) => index.columns.length > 0 && index.columns.length <= maxKeyColumns);
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

import {
  DatabaseSchema,
  ForeignKeyMetadata,
  TableData,
  TableMetadata,
} from '../types/introspection';

export function buildTableKey(schemaName: string | null | undefined, tableName: string): string {
  return `${normalizeSchemaName(schemaName)}.${tableName}`.toLowerCase();
}

export function getTableKey(table: Pick<TableMetadata, 'name' | 'schemaName'>): string {
  return buildTableKey(table.schemaName, table.name);
}

export function getForeignKeyReferencedTableKey(
  foreignKey: Pick<ForeignKeyMetadata, 'referencedTable' | 'referencedTableSchemaName'>,
): string {
  return buildTableKey(foreignKey.referencedTableSchemaName, foreignKey.referencedTable);
}

export function getTableDataKey(tableData: Pick<TableData, 'tableName' | 'schemaName'>): string {
  return buildTableKey(tableData.schemaName, tableData.tableName);
}

export function getQualifiedTableName(table: Pick<TableMetadata, 'name' | 'schemaName'>): string {
  return qualifyTableName(table.name, table.schemaName);
}

export function qualifyTableName(tableName: string, schemaName?: string | null): string {
  const normalizedSchema = normalizeSchemaName(schemaName);
  if (normalizedSchema === 'dbo' || normalizedSchema === 'public') {
    return tableName;
  }

  return `${normalizedSchema}_${tableName}`;
}

export function formatMssqlQualifiedTableName(
  table: Pick<TableMetadata, 'name' | 'schemaName'> | Pick<TableData, 'tableName' | 'schemaName'>,
): string {
  const schemaName = table.schemaName;
  const tableName = 'name' in table ? table.name : table.tableName;
  return `[${escapeSqlIdentifier(normalizeSchemaName(schemaName))}].[${escapeSqlIdentifier(tableName)}]`;
}

export function getUsedNonDefaultSchemaNames(schema: DatabaseSchema): string[] {
  const schemaNames = new Set<string>();

  for (const table of schema.tables) {
    const normalized = normalizeSchemaName(table.schemaName);
    if (!isDefaultSchemaName(normalized)) {
      schemaNames.add(normalized);
    }
  }

  for (const aliasType of schema.aliasTypes ?? []) {
    const normalized = normalizeSchemaName(aliasType.schemaName);
    if (!isDefaultSchemaName(normalized)) {
      schemaNames.add(normalized);
    }
  }

  return Array.from(schemaNames).sort((left, right) => left.localeCompare(right));
}

function normalizeSchemaName(schemaName: string | null | undefined): string {
  return schemaName && schemaName.trim().length > 0 ? schemaName : 'dbo';
}

function isDefaultSchemaName(schemaName: string): boolean {
  return schemaName === 'dbo' || schemaName === 'public';
}

function escapeSqlIdentifier(value: string): string {
  return value.replaceAll(']', ']]');
}

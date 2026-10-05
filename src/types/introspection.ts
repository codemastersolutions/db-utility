export interface ColumnMetadata {
  name: string;
  dataType: string;
  primitiveDataType?: string | null;
  aliasTypeName?: string | null;
  aliasTypeSchema?: string | null;
  isNullable: boolean;
  hasDefault: boolean;
  defaultValue?: string | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
  maxLength?: number | null;
  effectiveMaxLength?: number | null;
  numericPrecision?: number | null;
  numericScale?: number | null;
  description?: string | null;
}

export interface IndexMetadata {
  name: string;
  columns: string[];
  includedColumns?: string[];
  isUnique: boolean;
  isPrimary: boolean;
  /**
   * Raw WHERE clause for filtered indexes (MSSQL). When set, the generator
   * emits the index via raw `CREATE INDEX ... WHERE <filter>` SQL instead
   * of the dialect-agnostic `addIndex` helper.
   */
  filterDefinition?: string | null;
}

export interface ForeignKeyMetadata {
  name: string;
  tableName: string;
  tableSchemaName?: string;
  columns: string[];
  referencedTable: string;
  referencedTableSchemaName?: string;
  referencedColumns: string[];
  updateRule?: string;
  deleteRule?: string;
}

export interface TableMetadata {
  name: string;
  schemaName?: string;
  columns: ColumnMetadata[];
  indexes: IndexMetadata[];
  foreignKeys: ForeignKeyMetadata[];
  description?: string | null;
}

export interface AliasTypeMetadata {
  name: string;
  schemaName: string;
  baseDataType: string;
  maxLength?: number | null;
  numericPrecision?: number | null;
  numericScale?: number | null;
  isNullable: boolean;
}

export interface DatabaseSchema {
  tables: TableMetadata[];
  aliasTypes?: AliasTypeMetadata[];
}

export interface TableData {
  tableName: string;
  schemaName?: string;
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  disableIdentity?: boolean;
}

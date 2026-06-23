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
  numericPrecision?: number | null;
  numericScale?: number | null;
}

export interface IndexMetadata {
  name: string;
  columns: string[];
  includedColumns?: string[];
  isUnique: boolean;
  isPrimary: boolean;
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
  rows: Record<string, any>[];
  disableIdentity?: boolean;
}

export interface ColumnMetadata {
  name: string;
  dataType: string;
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
  isUnique: boolean;
  isPrimary: boolean;
}

export interface ForeignKeyMetadata {
  name: string;
  tableName: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  updateRule?: string;
  deleteRule?: string;
}

export interface TableMetadata {
  name: string;
  columns: ColumnMetadata[];
  indexes: IndexMetadata[];
  foreignKeys: ForeignKeyMetadata[];
}

export interface DatabaseSchema {
  tables: TableMetadata[];
}

export interface TableData {
  tableName: string;
  columns: ColumnMetadata[];
  rows: Record<string, any>[];
  disableIdentity?: boolean;
}

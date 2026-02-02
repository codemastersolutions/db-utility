import { BaseIntrospector } from './Introspector';
import {
  ColumnMetadata,
  DatabaseSchema,
  ForeignKeyMetadata,
  IndexMetadata,
  TableMetadata,
} from '../types/introspection';

interface MssqlTableRow {
  table_name: string;
}

interface MssqlColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_identity: number;
}

interface MssqlPkRow {
  table_name: string;
  column_name: string;
}

interface MssqlIndexRow {
  table_name: string;
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  column_name: string;
  key_ordinal: number;
}

interface MssqlFkRow {
  constraint_name: string;
  table_name: string;
  column_name: string;
  referenced_table_name: string;
  referenced_column_name: string;
  update_rule: string;
  delete_rule: string;
}

export class MssqlIntrospector extends BaseIntrospector {
  async introspectSchema(): Promise<DatabaseSchema> {
    const tables = await this.loadTables();
    const columns = await this.loadColumns();
    const primaryKeys = await this.loadPrimaryKeys();
    const indexes = await this.loadIndexes();
    const foreignKeys = await this.loadForeignKeys();

    const tableMap = new Map<string, TableMetadata>();

    tables.forEach((t) => {
      tableMap.set(t.table_name, {
        name: t.table_name,
        columns: [],
        indexes: [],
        foreignKeys: [],
      });
    });

    const pkColumnsByTable = new Map<string, Set<string>>();

    primaryKeys.forEach((pk) => {
      if (!pkColumnsByTable.has(pk.table_name)) {
        pkColumnsByTable.set(pk.table_name, new Set());
      }
      pkColumnsByTable.get(pk.table_name)?.add(pk.column_name);
    });

    columns.forEach((c) => {
      const table = tableMap.get(c.table_name);
      if (!table) return;

      const pkSet = pkColumnsByTable.get(c.table_name);

      const column: ColumnMetadata = {
        name: c.column_name,
        dataType: c.data_type,
        isNullable: c.is_nullable === 'YES',
        hasDefault: c.column_default !== null,
        defaultValue: c.column_default,
        isPrimaryKey: pkSet ? pkSet.has(c.column_name) : false,
        isUnique: false,
        isAutoIncrement: c.is_identity === 1,
        maxLength: c.character_maximum_length,
        numericPrecision: c.numeric_precision,
        numericScale: c.numeric_scale,
      };

      table.columns.push(column);
    });

    const indexMap = new Map<string, IndexMetadata>();

    indexes.forEach((i) => {
      const key = `${i.table_name}:${i.index_name}`;
      if (!indexMap.has(key)) {
        indexMap.set(key, {
          name: i.index_name,
          columns: [],
          isUnique: i.is_unique,
          isPrimary: i.is_primary,
        });
      }

      const entry = indexMap.get(key);
      if (!entry) return;
      entry.columns.push(i.column_name);
    });

    indexMap.forEach((idx, key) => {
      const tableName = key.split(':')[0];
      const table = tableMap.get(tableName);
      if (!table) return;
      table.indexes.push(idx);
    });

    const fkMap = new Map<string, ForeignKeyMetadata>();

    foreignKeys.forEach((fk) => {
      const key = `${fk.table_name}:${fk.constraint_name}`;
      if (!fkMap.has(key)) {
        fkMap.set(key, {
          name: fk.constraint_name,
          tableName: fk.table_name,
          columns: [],
          referencedTable: fk.referenced_table_name,
          referencedColumns: [],
          updateRule: fk.update_rule,
          deleteRule: fk.delete_rule,
        });
      }

      const entry = fkMap.get(key);
      if (!entry) return;
      entry.columns.push(fk.column_name);
      entry.referencedColumns.push(fk.referenced_column_name);
    });

    fkMap.forEach((fk) => {
      const table = tableMap.get(fk.tableName);
      if (!table) return;
      table.foreignKeys.push(fk);
    });

    return {
      tables: Array.from(tableMap.values()),
    };
  }

  private async loadTables(): Promise<MssqlTableRow[]> {
    const sql = `
      SELECT TABLE_NAME AS table_name
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;

    return this.connector.query<MssqlTableRow>(sql);
  }

  private async loadColumns(): Promise<MssqlColumnRow[]> {
    const sql = `
      SELECT
        TABLE_NAME AS table_name,
        COLUMN_NAME AS column_name,
        DATA_TYPE AS data_type,
        IS_NULLABLE AS is_nullable,
        COLUMN_DEFAULT AS column_default,
        CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,
        NUMERIC_PRECISION AS numeric_precision,
        NUMERIC_SCALE AS numeric_scale,
        COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA + '.' + TABLE_NAME), COLUMN_NAME, 'IsIdentity') AS is_identity
      FROM INFORMATION_SCHEMA.COLUMNS
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `;

    return this.connector.query<MssqlColumnRow>(sql);
  }

  private async loadPrimaryKeys(): Promise<MssqlPkRow[]> {
    const sql = `
      SELECT
        ku.table_name,
        ku.column_name
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS ku
        ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ORDER BY ku.table_name, ku.ordinal_position
    `;

    return this.connector.query<MssqlPkRow>(sql);
  }

  private async loadIndexes(): Promise<MssqlIndexRow[]> {
    const sql = `
      SELECT
        t.name AS table_name,
        ind.name AS index_name,
        ind.is_unique,
        ind.is_primary_key AS is_primary,
        col.name AS column_name,
        ic.key_ordinal
      FROM sys.indexes ind
      INNER JOIN sys.index_columns ic
        ON ind.object_id = ic.object_id
       AND ind.index_id = ic.index_id
      INNER JOIN sys.columns col
        ON ic.object_id = col.object_id
       AND ic.column_id = col.column_id
      INNER JOIN sys.tables t
        ON ind.object_id = t.object_id
      WHERE t.is_ms_shipped = 0
      ORDER BY t.name, ind.name, ic.key_ordinal
    `;

    return this.connector.query<MssqlIndexRow>(sql);
  }

  private async loadForeignKeys(): Promise<MssqlFkRow[]> {
    const sql = `
      SELECT
        fk.name AS constraint_name,
        tp.name AS table_name,
        cp.name AS column_name,
        tr.name AS referenced_table_name,
        cr.name AS referenced_column_name,
        rc.UPDATE_RULE AS update_rule,
        rc.DELETE_RULE AS delete_rule
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc
        ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.tables tp
        ON fkc.parent_object_id = tp.object_id
      INNER JOIN sys.columns cp
        ON fkc.parent_object_id = cp.object_id
       AND fkc.parent_column_id = cp.column_id
      INNER JOIN sys.tables tr
        ON fkc.referenced_object_id = tr.object_id
      INNER JOIN sys.columns cr
        ON fkc.referenced_object_id = cr.object_id
       AND fkc.referenced_column_id = cr.column_id
      INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON fk.name = rc.CONSTRAINT_NAME
      ORDER BY tp.name, fk.name, fkc.constraint_column_id
    `;

    return this.connector.query<MssqlFkRow>(sql);
  }
}

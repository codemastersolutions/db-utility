import { BaseIntrospector } from './Introspector';
import {
  ColumnMetadata,
  DatabaseSchema,
  ForeignKeyMetadata,
  IndexMetadata,
  TableMetadata,
} from '../types/introspection';
import { normalizeDatabaseDefault } from '../utils/DefaultValueUtils';
import { buildTableKey } from '../utils/TableNameUtils';

interface MssqlTableRow {
  schema_name: string;
  table_name: string;
}

interface MssqlColumnRow {
  schema_name: string;
  table_name: string;
  column_name: string;
  data_type: string;
  primitive_data_type?: string | null;
  alias_type_name?: string | null;
  alias_type_schema?: string | null;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_identity: number;
}

interface MssqlPkRow {
  schema_name: string;
  table_name: string;
  column_name: string;
}

interface MssqlIndexRow {
  schema_name: string;
  table_name: string;
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  column_name: string;
  key_ordinal: number;
  is_included_column: boolean;
}

interface MssqlFkRow {
  constraint_name: string;
  schema_name: string;
  table_name: string;
  column_name: string;
  referenced_schema_name: string;
  referenced_table_name: string;
  referenced_column_name: string;
  update_rule: string;
  delete_rule: string;
}

interface MssqlAliasTypeRow {
  type_name: string;
  schema_name: string;
  base_data_type: string;
  max_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_nullable: boolean;
}

export class MssqlIntrospector extends BaseIntrospector {
  async introspectSchema(): Promise<DatabaseSchema> {
    const tables = await this.loadTables();
    const columns = await this.loadColumns();
    const primaryKeys = await this.loadPrimaryKeys();
    const indexes = await this.loadIndexes();
    const foreignKeys = await this.loadForeignKeys();
    const aliasTypes = columns.some((column) => column.alias_type_name)
      ? await this.loadAliasTypes()
      : [];

    const tableMap = new Map<string, TableMetadata>();

    tables.forEach((t) => {
      tableMap.set(buildTableKey(t.schema_name, t.table_name), {
        name: t.table_name,
        schemaName: t.schema_name,
        columns: [],
        indexes: [],
        foreignKeys: [],
      });
    });

    const pkColumnsByTable = new Map<string, Set<string>>();

    primaryKeys.forEach((pk) => {
      const tableKey = buildTableKey(pk.schema_name, pk.table_name);
      if (!pkColumnsByTable.has(tableKey)) {
        pkColumnsByTable.set(tableKey, new Set());
      }
      pkColumnsByTable.get(tableKey)?.add(pk.column_name);
    });

    columns.forEach((c) => {
      const tableKey = buildTableKey(c.schema_name, c.table_name);
      const table = tableMap.get(tableKey);
      if (!table) return;

      const pkSet = pkColumnsByTable.get(tableKey);

      const column: ColumnMetadata = {
        name: c.column_name,
        dataType: c.data_type,
        primitiveDataType: c.primitive_data_type ?? null,
        aliasTypeName: c.alias_type_name ?? null,
        aliasTypeSchema: c.alias_type_schema ?? null,
        isNullable: c.is_nullable === 'YES',
        hasDefault: c.column_default !== null,
        defaultValue: this.normalizeDefaultValue(c.column_default),
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
      const tableKey = buildTableKey(i.schema_name, i.table_name);
      const key = `${tableKey}:${i.index_name}`;
      if (!indexMap.has(key)) {
        indexMap.set(key, {
          name: i.index_name,
          columns: [],
          includedColumns: [],
          isUnique: i.is_unique,
          isPrimary: i.is_primary,
        });
      }

      const entry = indexMap.get(key);
      if (!entry) return;
      if (i.is_included_column || i.key_ordinal === 0) {
        entry.includedColumns?.push(i.column_name);
        return;
      }

      entry.columns.push(i.column_name);
    });

    indexMap.forEach((idx, key) => {
      const tableKey = key.slice(0, key.lastIndexOf(':'));
      const table = tableMap.get(tableKey);
      if (!table) return;
      table.indexes.push(idx);
    });

    const fkMap = new Map<string, ForeignKeyMetadata>();

    foreignKeys.forEach((fk) => {
      const tableKey = buildTableKey(fk.schema_name, fk.table_name);
      const key = `${tableKey}:${fk.constraint_name}`;
      if (!fkMap.has(key)) {
        fkMap.set(key, {
          name: fk.constraint_name,
          tableName: fk.table_name,
          tableSchemaName: fk.schema_name,
          columns: [],
          referencedTable: fk.referenced_table_name,
          referencedTableSchemaName: fk.referenced_schema_name,
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
      const table = tableMap.get(buildTableKey(fk.tableSchemaName, fk.tableName));
      if (!table) return;
      table.foreignKeys.push(fk);
    });

    const populatedTables = Array.from(tableMap.values()).filter(
      (table) => table.columns.length > 0,
    );

    return {
      tables: populatedTables,
      aliasTypes: aliasTypes.map((aliasType) => ({
        name: aliasType.type_name,
        schemaName: aliasType.schema_name,
        baseDataType: aliasType.base_data_type,
        maxLength: aliasType.max_length,
        numericPrecision: aliasType.numeric_precision,
        numericScale: aliasType.numeric_scale,
        isNullable: aliasType.is_nullable,
      })),
    };
  }

  private async loadTables(): Promise<MssqlTableRow[]> {
    const sql = `
      SELECT
        SCHEMA_NAME(t.schema_id) AS schema_name,
        t.name AS table_name
      FROM sys.tables t
      WHERE t.is_ms_shipped = 0
      ORDER BY SCHEMA_NAME(t.schema_id), t.name
    `;

    return this.connector.query<MssqlTableRow>(sql);
  }

  private async loadColumns(): Promise<MssqlColumnRow[]> {
    const sql = `
      SELECT
        SCHEMA_NAME(t.schema_id) AS schema_name,
        t.name AS table_name,
        c.name AS column_name,
        user_type.name AS data_type,
        CASE
          WHEN user_type.name <> base_type.name THEN base_type.name
          ELSE NULL
        END AS primitive_data_type,
        CASE
          WHEN user_type.is_user_defined = 1 AND user_type.name <> base_type.name THEN user_type.name
          ELSE NULL
        END AS alias_type_name,
        CASE
          WHEN user_type.is_user_defined = 1 AND user_type.name <> base_type.name THEN SCHEMA_NAME(user_type.schema_id)
          ELSE NULL
        END AS alias_type_schema,
        CASE
          WHEN c.is_nullable = 1 THEN 'YES'
          ELSE 'NO'
        END AS is_nullable,
        OBJECT_DEFINITION(c.default_object_id) AS column_default,
        CASE
          WHEN base_type.name IN ('nchar', 'nvarchar') AND c.max_length > 0 THEN c.max_length / 2
          ELSE c.max_length
        END AS character_maximum_length,
        c.precision AS numeric_precision,
        c.scale AS numeric_scale,
        c.is_identity AS is_identity
      FROM sys.tables t
      INNER JOIN sys.columns c
        ON t.object_id = c.object_id
      INNER JOIN sys.types user_type
        ON c.user_type_id = user_type.user_type_id
      INNER JOIN sys.types base_type
        ON c.system_type_id = base_type.user_type_id
       AND base_type.user_type_id = base_type.system_type_id
      WHERE t.is_ms_shipped = 0
      ORDER BY SCHEMA_NAME(t.schema_id), t.name, c.column_id
    `;

    return this.connector.query<MssqlColumnRow>(sql);
  }

  private async loadPrimaryKeys(): Promise<MssqlPkRow[]> {
    const sql = `
      SELECT
        tc.TABLE_SCHEMA AS schema_name,
        ku.table_name,
        ku.column_name
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS ku
        ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
       AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
       AND tc.TABLE_NAME = ku.TABLE_NAME
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ORDER BY tc.TABLE_SCHEMA, ku.table_name, ku.ordinal_position
    `;

    return this.connector.query<MssqlPkRow>(sql);
  }

  private async loadIndexes(): Promise<MssqlIndexRow[]> {
    const sql = `
      SELECT
        SCHEMA_NAME(t.schema_id) AS schema_name,
        t.name AS table_name,
        ind.name AS index_name,
        ind.is_unique,
        ind.is_primary_key AS is_primary,
        col.name AS column_name,
        ic.key_ordinal,
        ic.is_included_column
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
      ORDER BY SCHEMA_NAME(t.schema_id), t.name, ind.name, ic.key_ordinal
    `;

    return this.connector.query<MssqlIndexRow>(sql);
  }

  private async loadForeignKeys(): Promise<MssqlFkRow[]> {
    const sql = `
      SELECT
        fk.name AS constraint_name,
        SCHEMA_NAME(tp.schema_id) AS schema_name,
        tp.name AS table_name,
        cp.name AS column_name,
        SCHEMA_NAME(tr.schema_id) AS referenced_schema_name,
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
      ORDER BY SCHEMA_NAME(tp.schema_id), tp.name, fk.name, fkc.constraint_column_id
    `;

    return this.connector.query<MssqlFkRow>(sql);
  }

  private async loadAliasTypes(): Promise<MssqlAliasTypeRow[]> {
    const sql = `
      SELECT
        user_type.name AS type_name,
        schema_info.name AS schema_name,
        base_type.name AS base_data_type,
        CASE
          WHEN base_type.name IN ('nchar', 'nvarchar') AND user_type.max_length > 0
            THEN user_type.max_length / 2
          ELSE user_type.max_length
        END AS max_length,
        user_type.precision AS numeric_precision,
        user_type.scale AS numeric_scale,
        user_type.is_nullable
      FROM sys.types user_type
      INNER JOIN sys.schemas schema_info
        ON user_type.schema_id = schema_info.schema_id
      INNER JOIN sys.types base_type
        ON user_type.system_type_id = base_type.user_type_id
       AND base_type.user_type_id = base_type.system_type_id
      WHERE user_type.is_user_defined = 1
        AND user_type.is_table_type = 0
      ORDER BY schema_info.name, user_type.name
    `;

    return this.connector.query<MssqlAliasTypeRow>(sql);
  }

  private normalizeDefaultValue(defaultValue: string | null): string | null {
    return defaultValue === null ? null : normalizeDatabaseDefault(defaultValue);
  }
}

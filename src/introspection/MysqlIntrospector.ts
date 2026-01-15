import { BaseIntrospector } from './Introspector';
import {
  ColumnMetadata,
  DatabaseSchema,
  ForeignKeyMetadata,
  IndexMetadata,
  TableMetadata,
} from '../types/introspection';

interface MysqlTableRow {
  table_name: string;
}

interface MysqlColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  extra: string;
}

interface MysqlIndexRow {
  table_name: string;
  index_name: string;
  non_unique: number;
  column_name: string;
  seq_in_index: number;
}

interface MysqlFkRow {
  constraint_name: string;
  table_name: string;
  column_name: string;
  referenced_table_name: string;
  referenced_column_name: string;
  update_rule: string;
  delete_rule: string;
}

export class MysqlIntrospector extends BaseIntrospector {
  async introspectSchema(): Promise<DatabaseSchema> {
    const tables = await this.loadTables();
    const columns = await this.loadColumns();
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
    const uniqueColumnsByTable = new Map<string, Set<string>>();

    indexes
      .filter((i) => i.index_name === 'PRIMARY')
      .forEach((i) => {
        if (!pkColumnsByTable.has(i.table_name)) {
          pkColumnsByTable.set(i.table_name, new Set());
        }
        pkColumnsByTable.get(i.table_name)?.add(i.column_name);
      });

    indexes
      .filter((i) => i.index_name !== 'PRIMARY' && i.non_unique === 0)
      .forEach((i) => {
        if (!uniqueColumnsByTable.has(i.table_name)) {
          uniqueColumnsByTable.set(i.table_name, new Set());
        }
        uniqueColumnsByTable.get(i.table_name)?.add(i.column_name);
      });

    columns.forEach((c) => {
      const table = tableMap.get(c.table_name);
      if (!table) return;

      const pkSet = pkColumnsByTable.get(c.table_name);
      const uniqueSet = uniqueColumnsByTable.get(c.table_name);

      const column: ColumnMetadata = {
        name: c.column_name,
        dataType: c.data_type,
        isNullable: c.is_nullable === 'YES',
        hasDefault: c.column_default !== null,
        defaultValue: c.column_default,
        isPrimaryKey: pkSet ? pkSet.has(c.column_name) : false,
        isUnique: uniqueSet ? uniqueSet.has(c.column_name) : false,
        isAutoIncrement: c.extra.toLowerCase().includes('auto_increment'),
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
          isUnique: i.non_unique === 0,
          isPrimary: i.index_name === 'PRIMARY',
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

  private async loadTables(): Promise<MysqlTableRow[]> {
    const sql = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    return this.connector.query<MysqlTableRow>(sql);
  }

  private async loadColumns(): Promise<MysqlColumnRow[]> {
    const sql = `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        extra
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
      ORDER BY table_name, ordinal_position
    `;

    return this.connector.query<MysqlColumnRow>(sql);
  }

  private async loadIndexes(): Promise<MysqlIndexRow[]> {
    const sql = `
      SELECT
        table_name,
        index_name,
        non_unique,
        column_name,
        seq_in_index
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
      ORDER BY table_name, index_name, seq_in_index
    `;

    return this.connector.query<MysqlIndexRow>(sql);
  }

  private async loadForeignKeys(): Promise<MysqlFkRow[]> {
    const sql = `
      SELECT
        rc.constraint_name,
        kcu.table_name,
        kcu.column_name,
        kcu.referenced_table_name,
        kcu.referenced_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.referential_constraints AS rc
      JOIN information_schema.key_column_usage AS kcu
        ON rc.constraint_name = kcu.constraint_name
       AND rc.constraint_schema = kcu.table_schema
      WHERE kcu.table_schema = DATABASE()
      ORDER BY kcu.table_name, rc.constraint_name, kcu.ordinal_position
    `;

    return this.connector.query<MysqlFkRow>(sql);
  }
}


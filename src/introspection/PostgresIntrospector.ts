import {
  ColumnMetadata,
  DatabaseSchema,
  ForeignKeyMetadata,
  IndexMetadata,
  TableMetadata,
} from '../types/introspection';
import { BaseIntrospector } from './Introspector';

interface PgTableRow {
  table_name: string;
}

interface PgColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

interface PgConstraintRow {
  table_name: string;
  constraint_name: string;
  constraint_type: string;
  column_name: string;
}

interface PgIndexRow {
  table_name: string;
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  column_names: string[];
}

interface PgFkRow {
  constraint_name: string;
  table_name: string;
  column_name: string;
  referenced_table_name: string;
  referenced_column_name: string;
  update_rule: string;
  delete_rule: string;
}

export class PostgresIntrospector extends BaseIntrospector {
  async introspectSchema(): Promise<DatabaseSchema> {
    const tables = await this.loadTables();
    const columns = await this.loadColumns();
    const constraints = await this.loadConstraints();
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

    constraints.forEach((c) => {
      if (c.constraint_type === 'PRIMARY KEY') {
        if (!pkColumnsByTable.has(c.table_name)) {
          pkColumnsByTable.set(c.table_name, new Set());
        }
        pkColumnsByTable.get(c.table_name)?.add(c.column_name);
      }
      if (c.constraint_type === 'UNIQUE') {
        if (!uniqueColumnsByTable.has(c.table_name)) {
          uniqueColumnsByTable.set(c.table_name, new Set());
        }
        uniqueColumnsByTable.get(c.table_name)?.add(c.column_name);
      }
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
        isAutoIncrement: c.column_default !== null && c.column_default.includes('nextval'),
        maxLength: c.character_maximum_length,
        numericPrecision: c.numeric_precision,
        numericScale: c.numeric_scale,
      };

      table.columns.push(column);
    });

    indexes.forEach((i) => {
      const table = tableMap.get(i.table_name);
      if (!table) return;

      const index: IndexMetadata = {
        name: i.index_name,
        columns: i.column_names,
        isUnique: i.is_unique,
        isPrimary: i.is_primary,
      };

      table.indexes.push(index);
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
      const tableEntry = tableMap.get(fk.tableName);
      if (!tableEntry) return;
      tableEntry.foreignKeys.push(fk);
    });

    return {
      tables: Array.from(tableMap.values()),
    };
  }

  private async loadTables(): Promise<PgTableRow[]> {
    const sql = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    return this.connector.query<PgTableRow>(sql);
  }

  private async loadColumns(): Promise<PgColumnRow[]> {
    const sql = `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;

    return this.connector.query<PgColumnRow>(sql);
  }

  private async loadConstraints(): Promise<PgConstraintRow[]> {
    const sql = `
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
    `;

    return this.connector.query<PgConstraintRow>(sql);
  }

  private async loadIndexes(): Promise<PgIndexRow[]> {
    const sql = `
      SELECT
        t.relname AS table_name,
        i.relname AS index_name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary,
        ARRAY_AGG(a.attname ORDER BY array_position(ix.indkey, a.attnum::smallint)) AS column_names
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_namespace ns ON ns.oid = t.relnamespace
      WHERE ns.nspname = 'public'
        AND t.relkind = 'r'
      GROUP BY t.relname, i.relname, ix.indisunique, ix.indisprimary
      ORDER BY t.relname, i.relname
    `;

    return this.connector.query<PgIndexRow>(sql);
  }

  private async loadForeignKeys(): Promise<PgFkRow[]> {
    const sql = `
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS referenced_table_name,
        ccu.column_name AS referenced_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
       AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
    `;

    return this.connector.query<PgFkRow>(sql);
  }
}

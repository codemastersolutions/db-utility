import { IDatabaseConnector, DatabaseType } from '../types/database';
import { DatabaseSchema, TableData } from '../types/introspection';
import { DataTableConfig } from '../config/AppConfig';
import { buildTableKey, formatMssqlQualifiedTableName } from '../utils/TableNameUtils';

export class DataExtractor {
  constructor(
    private readonly connector: IDatabaseConnector,
    private readonly type: DatabaseType,
  ) {}

  async extract(
    schema: DatabaseSchema,
    tables: (string | DataTableConfig)[],
  ): Promise<TableData[]> {
    const result: TableData[] = [];

    for (const tableConfig of tables) {
      const tableName = typeof tableConfig === 'string' ? tableConfig : tableConfig.table;
      const whereClause = typeof tableConfig === 'string' ? undefined : tableConfig.where;
      const disableIdentity =
        typeof tableConfig === 'string' ? undefined : tableConfig.disableIdentity;
      const allowedColumns =
        typeof tableConfig === 'string' || !tableConfig.columns || tableConfig.columns.length === 0
          ? undefined
          : new Set(tableConfig.columns);

      const [requestedSchemaName, requestedTableName] = this.parseRequestedTableName(tableName);
      const targetKey = buildTableKey(requestedSchemaName, requestedTableName);
      const table = schema.tables.find(
        (entry) => buildTableKey(entry.schemaName, entry.name) === targetKey,
      );

      if (!table) {
        console.warn(`Table ${tableName} not found in schema, skipping.`);
        continue;
      }

      const filteredColumns = allowedColumns
        ? table.columns.filter((c) => allowedColumns.has(c.name))
        : table.columns;

      if (allowedColumns && filteredColumns.length === 0) {
        console.warn(
          `No matching columns found for table ${tableName} with specified column filter, skipping.`,
        );
        continue;
      }

      const quotedName = this.quoteIdentifier(table);
      const columnList = allowedColumns
        ? Array.from(allowedColumns)
            .map((c) => this.quoteSingleIdentifier(c))
            .join(', ')
        : '*';
      let sql = `SELECT ${columnList} FROM ${quotedName}`;

      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }

      try {
        const rawRows = await this.connector.query<Record<string, unknown>>(sql, [], {
          bypassSafety: true,
        });
        const rows = allowedColumns
          ? rawRows.map((row) => {
              const filtered: Record<string, unknown> = {};
              for (const col of Array.from(allowedColumns)) {
                if (Object.prototype.hasOwnProperty.call(row, col)) {
                  filtered[col] = row[col];
                }
              }
              return filtered;
            })
          : rawRows;
        result.push({
          tableName: table.name,
          schemaName: table.schemaName,
          columns: filteredColumns,
          rows,
          disableIdentity,
        });
      } catch (error) {
        console.error(`Error extracting data from ${table.name}:`, error);
      }
    }

    return result;
  }

  private parseRequestedTableName(value: string): [string | undefined, string] {
    const parts = value.split('.');
    if (parts.length === 2) {
      return [parts[0], parts[1]];
    }

    return [undefined, value];
  }

  private quoteIdentifier(table: { name: string; schemaName?: string }): string {
    switch (this.type) {
      case 'postgres':
        return table.schemaName ? `"${table.schemaName}"."${table.name}"` : `"${table.name}"`;
      case 'mysql':
        return table.schemaName ? `\`${table.schemaName}\`.\`${table.name}\`` : `\`${table.name}\``;
      case 'mssql':
        return formatMssqlQualifiedTableName(table);
      default:
        return `"${table.name}"`;
    }
  }

  private quoteSingleIdentifier(identifier: string): string {
    switch (this.type) {
      case 'postgres':
        return `"${identifier}"`;
      case 'mysql':
        return `\`${identifier}\``;
      case 'mssql':
        return `[${identifier}]`;
      default:
        return `"${identifier}"`;
    }
  }
}

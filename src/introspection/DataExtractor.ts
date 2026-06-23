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

      const [requestedSchemaName, requestedTableName] = this.parseRequestedTableName(tableName);
      const targetKey = buildTableKey(requestedSchemaName, requestedTableName);
      const table = schema.tables.find((entry) => buildTableKey(entry.schemaName, entry.name) === targetKey);

      if (!table) {
        console.warn(`Table ${tableName} not found in schema, skipping.`);
        continue;
      }

      const quotedName = this.quoteIdentifier(table);
      let sql = `SELECT * FROM ${quotedName}`;

      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }

      try {
        const rows = await this.connector.query<Record<string, any>>(sql, [], {
          bypassSafety: true,
        });
        result.push({
          tableName: table.name,
          schemaName: table.schemaName,
          columns: table.columns,
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
}

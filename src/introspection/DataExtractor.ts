import { IDatabaseConnector, DatabaseType } from '../types/database';
import { DatabaseSchema, TableData } from '../types/introspection';
import { DataTableConfig } from '../config/AppConfig';

export class DataExtractor {
  constructor(
    private connector: IDatabaseConnector,
    private type: DatabaseType,
  ) {}

  async extract(
    schema: DatabaseSchema,
    tables: (string | DataTableConfig)[],
  ): Promise<TableData[]> {
    const result: TableData[] = [];

    for (const tableConfig of tables) {
      const tableName = typeof tableConfig === 'string' ? tableConfig : tableConfig.table;
      const whereClause = typeof tableConfig === 'string' ? undefined : tableConfig.where;
      const disableIdentity = typeof tableConfig === 'string' ? undefined : tableConfig.disableIdentity;

      const targetName = tableName.toLowerCase();
      const table = schema.tables.find((t) => t.name.toLowerCase() === targetName);

      if (!table) {
        console.warn(`Table ${tableName} not found in schema, skipping.`);
        continue;
      }

      const quotedName = this.quoteIdentifier(table.name);
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

  private quoteIdentifier(name: string): string {
    switch (this.type) {
      case 'postgres':
        return `"${name}"`;
      case 'mysql':
        return `\`${name}\``;
      case 'mssql':
        return `[${name}]`;
      default:
        return `"${name}"`;
    }
  }
}

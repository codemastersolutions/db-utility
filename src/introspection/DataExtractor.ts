import { IDatabaseConnector, DatabaseType } from '../types/database';
import { DatabaseSchema, TableData } from '../types/introspection';

export class DataExtractor {
  constructor(
    private connector: IDatabaseConnector,
    private type: DatabaseType,
  ) {}

  async extract(schema: DatabaseSchema, tableNames: string[]): Promise<TableData[]> {
    const result: TableData[] = [];

    for (const tableName of tableNames) {
      const targetName = tableName.toLowerCase();
      const table = schema.tables.find((t) => t.name.toLowerCase() === targetName);

      if (!table) {
        console.warn(`Table ${tableName} not found in schema, skipping.`);
        continue;
      }

      const quotedName = this.quoteIdentifier(table.name);
      const sql = `SELECT * FROM ${quotedName}`;

      try {
        const rows = await this.connector.query<Record<string, any>>(sql, [], {
          bypassSafety: true,
        });
        result.push({
          tableName: table.name,
          columns: table.columns,
          rows,
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

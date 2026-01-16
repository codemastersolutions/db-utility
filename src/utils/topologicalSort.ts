import { DatabaseSchema, TableMetadata } from '../types/introspection';

export function topologicalSort(schema: DatabaseSchema): TableMetadata[] {
  const tables = schema.tables;
  const tableMap = new Map<string, TableMetadata>();
  tables.forEach((t) => tableMap.set(t.name, t));

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: TableMetadata[] = [];

  function visit(tableName: string) {
    if (visited.has(tableName)) return;
    if (visiting.has(tableName)) {
      // Circular dependency detected, ignore for now to prevent infinite loop
      // In a real migration system, this might require creating tables first then adding FKs
      return;
    }

    visiting.add(tableName);

    const table = tableMap.get(tableName);
    if (table) {
      for (const fk of table.foreignKeys) {
        if (tableMap.has(fk.referencedTable) && fk.referencedTable !== tableName) {
          visit(fk.referencedTable);
        }
      }
    }

    visiting.delete(tableName);
    visited.add(tableName);
    if (table) {
      sorted.push(table);
    }
  }

  for (const table of tables) {
    visit(table.name);
  }

  return sorted;
}

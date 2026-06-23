import { DatabaseSchema, TableMetadata } from '../types/introspection';
import { getForeignKeyReferencedTableKey, getTableKey } from './TableNameUtils';

export function topologicalSort(schema: DatabaseSchema): TableMetadata[] {
  const tables = schema.tables;
  const tableMap = new Map<string, TableMetadata>();
  tables.forEach((t) => tableMap.set(getTableKey(t), t));

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: TableMetadata[] = [];

  function visit(tableKey: string) {
    if (visited.has(tableKey)) return;
    if (visiting.has(tableKey)) {
      // Circular dependency detected, ignore for now to prevent infinite loop
      // In a real migration system, this might require creating tables first then adding FKs
      return;
    }

    visiting.add(tableKey);

    const table = tableMap.get(tableKey);
    if (table) {
      for (const fk of table.foreignKeys) {
        const referencedTableKey = getForeignKeyReferencedTableKey(fk);
        if (tableMap.has(referencedTableKey) && referencedTableKey !== tableKey) {
          visit(referencedTableKey);
        }
      }
    }

    visiting.delete(tableKey);
    visited.add(tableKey);
    if (table) {
      sorted.push(table);
    }
  }

  for (const table of tables) {
    visit(getTableKey(table));
  }

  return sorted;
}

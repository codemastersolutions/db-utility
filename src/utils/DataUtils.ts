import { TableData } from '../types/introspection';

/**
 * Filters out auto-increment columns from the table data rows.
 * This is useful for generating seed data where auto-increment columns should usually be omitted
 * to let the database handle the ID generation.
 *
 * @param tableData The table data containing columns definition and rows
 * @returns The rows with auto-increment columns removed
 */
export function filterAutoIncrementColumns(tableData: TableData): Record<string, any>[] {
  // If disableIdentity is true, we want to KEEP the auto-increment columns (meaning we insert explicit IDs)
  if (tableData.disableIdentity) {
    return tableData.rows;
  }

  const autoIncrementCols = new Set(
    tableData.columns.filter((c) => c.isAutoIncrement).map((c) => c.name),
  );

  if (autoIncrementCols.size === 0) {
    return tableData.rows;
  }

  return tableData.rows.map((row) => {
    const newRow: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      // Check if the key corresponds to an auto-increment column
      // We check exact match first
      if (autoIncrementCols.has(key)) {
        continue;
      }

      // If strict casing might be an issue, we could consider checking case-insensitive,
      // but usually the driver and introspection should match.
      // For safety against some driver quirks, we can check if any auto-inc col matches case-insensitively
      // ONLY IF exact match didn't find it? No, that might be dangerous if two columns differ only by case.
      // Let's stick to exact match as the Introspector and DataExtractor source from the same DB.

      newRow[key] = value;
    }
    return newRow;
  });
}

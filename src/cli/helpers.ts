import { join } from 'node:path';
import { AppConfig } from '../config/AppConfig';
import { DatabaseSchema } from '../types/introspection';
import { analyzeSchemaLimits } from '../utils/IndexUtils';

export const resolveMigrationOutputDir = (
  cwd: string,
  cliOutputOption: string | undefined,
  appConfig: AppConfig,
): string => {
  if (cliOutputOption) {
    return cliOutputOption;
  }

  if (appConfig.migrations?.outputDir) {
    return join(cwd, appConfig.migrations.outputDir);
  }

  return join(cwd, 'exports', 'migrations');
};

export const resolveDisableForeignKeys = (
  cliDisableForeignKeys: boolean | undefined,
  appConfig: AppConfig,
): boolean => {
  if (cliDisableForeignKeys === true) {
    return true;
  }

  return appConfig.migrations.disableForeignKeys ?? false;
};

export const resolveMigrationBackup = (
  cliBackup: boolean | undefined,
  appConfig: AppConfig,
): boolean => {
  if (cliBackup === true) {
    return true;
  }

  return appConfig.migrations.backup ?? false;
};

export const resolveShouldRunMigrationTests = (
  cliTest: boolean | undefined,
  backupEnabled: boolean,
): boolean => {
  if (cliTest === true) {
    return true;
  }

  return backupEnabled;
};

export interface IntrospectionWarningMessages {
  schemaLimitSummary: string;
  tablesOverColumnLimit: (count: number) => string;
  tableOverColumnLimitItem: (tableName: string, columnCount: number) => string;
  indexesOverKeyColumnLimit: (count: number) => string;
  indexOverKeyColumnLimitItem: (
    tableName: string,
    indexName: string,
    keyColumnCount: number,
  ) => string;
  schemaLimitMetadataHint: string;
}

export const buildIntrospectionWarnings = (
  schema: DatabaseSchema,
  messages: IntrospectionWarningMessages,
): string[] => {
  const analysis = analyzeSchemaLimits(schema);

  if (
    analysis.tablesOverColumnLimit.length === 0 &&
    analysis.indexesOverKeyColumnLimit.length === 0
  ) {
    return [];
  }

  const warnings = [messages.schemaLimitSummary];

  if (analysis.tablesOverColumnLimit.length > 0) {
    warnings.push(messages.tablesOverColumnLimit(analysis.tablesOverColumnLimit.length));
    warnings.push(
      ...analysis.tablesOverColumnLimit.map((table) =>
        messages.tableOverColumnLimitItem(table.tableName, table.columnCount),
      ),
    );
  }

  if (analysis.indexesOverKeyColumnLimit.length > 0) {
    warnings.push(messages.indexesOverKeyColumnLimit(analysis.indexesOverKeyColumnLimit.length));
    warnings.push(
      ...analysis.indexesOverKeyColumnLimit.map((index) =>
        messages.indexOverKeyColumnLimitItem(
          index.tableName,
          index.indexName,
          index.keyColumnCount,
        ),
      ),
    );
  }

  warnings.push(messages.schemaLimitMetadataHint);
  return warnings;
};

import { isAbsolute, join } from 'node:path';
import {
  AppConfig,
  DataTableConfig,
  MigrationConfig,
  getMigrationConfigEntries,
  getPrimaryMigrationConfig,
} from '../config/AppConfig';
import { DatabaseSchema } from '../types/introspection';
import { buildTableKey, getTableKey } from '../utils/TableNameUtils';
import { analyzeSchemaLimits } from '../utils/IndexUtils';

type MigrationConfigSource = AppConfig | MigrationConfig;
const fallbackMigrationConfig: MigrationConfig = {
  fileNamePattern: 'timestamp-prefix',
  backup: false,
  disableForeignKeys: false,
  disableTableExistsCheck: false,
  exportOnlyInDataTables: false,
};

const getMigrationConfig = (source: MigrationConfigSource): MigrationConfig => {
  if ('migrations' in source) {
    return source.migrations
      ? getPrimaryMigrationConfig(source.migrations)
      : fallbackMigrationConfig;
  }

  return source;
};

export const getMigrationConfigs = (appConfig: AppConfig): MigrationConfig[] =>
  getMigrationConfigEntries(appConfig.migrations);

export const resolveMigrationOutputDir = (
  cwd: string,
  cliOutputOption: string | undefined,
  source: MigrationConfigSource,
): string => {
  if (cliOutputOption) {
    return cliOutputOption;
  }

  const migrationConfig = getMigrationConfig(source);

  if (migrationConfig.outputDir) {
    return isAbsolute(migrationConfig.outputDir)
      ? migrationConfig.outputDir
      : join(cwd, migrationConfig.outputDir);
  }

  return join(cwd, 'exports', 'migrations');
};

export const resolveDisableForeignKeys = (
  cliDisableForeignKeys: boolean | undefined,
  source: MigrationConfigSource,
): boolean => {
  if (resolveExportOnlyInDataTables(source)) {
    return true;
  }

  if (cliDisableForeignKeys === true) {
    return true;
  }

  return getMigrationConfig(source).disableForeignKeys ?? false;
};

export const resolveDisableTableExistsCheck = (
  cliDisableTableExistsCheck: boolean | undefined,
  source: MigrationConfigSource,
): boolean => {
  if (cliDisableTableExistsCheck === true) {
    return true;
  }

  return getMigrationConfig(source).disableTableExistsCheck ?? false;
};

export const resolveExportOnlyInDataTables = (source: MigrationConfigSource): boolean =>
  getMigrationConfig(source).exportOnlyInDataTables ?? false;

export const filterSchemaByDataTables = (
  schema: DatabaseSchema,
  tables: (string | DataTableConfig)[],
): DatabaseSchema => {
  const selectedTableKeys = new Set(
    tables.map((entry) => {
      const rawTableName = typeof entry === 'string' ? entry : entry.table;
      const [schemaName, tableName] = parseRequestedTableName(rawTableName);
      return buildTableKey(schemaName, tableName);
    }),
  );

  return {
    ...schema,
    tables: schema.tables.filter((table) => selectedTableKeys.has(getTableKey(table))),
  };
};

export const resolveMigrationBackup = (
  cliBackup: boolean | undefined,
  source: MigrationConfigSource,
): boolean => {
  if (cliBackup === true) {
    return true;
  }

  return getMigrationConfig(source).backup ?? false;
};

const parseRequestedTableName = (value: string): [string | undefined, string] => {
  const parts = value.split('.');
  if (parts.length === 2) {
    return [parts[0], parts[1]];
  }

  return [undefined, value];
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

export const resolveMigrationConnectionName = (
  cliConnectionName: string | undefined,
  migrationConfig: MigrationConfig,
): string | undefined => cliConnectionName ?? migrationConfig.connectionName;

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

#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppConfigLoader } from '../config/AppConfig';
import { ConfigInitializer } from '../config/ConfigInitializer';
import { ConfigLoader } from '../config/ConfigLoader';
import { ConnectionFactory } from '../database/ConnectionFactory';
import { DbUtilitySecurityError } from '../database/SqlSafety';
import { DbUtilityError } from '../errors/DbUtilityError';
import { getMessages } from '../i18n/messages';
import { IntrospectionLogger } from '../introspection/IntrospectionLogger';
import { IntrospectionService } from '../introspection/IntrospectionService';
import { DatabaseConfig, DatabaseType } from '../types/database';

const appConfig = AppConfigLoader.load();
const messages = getMessages(appConfig.language);

const getPackageVersion = (): string => {
  try {
    const packageJsonPath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch {
    return '0.0.0';
  }
};

const program = new Command();

program
  .name('db-utility')
  .alias('dbutility')
  .description(messages.cli.appDescription)
  .version(getPackageVersion());

program
  .option('--init', messages.cli.initOptionDescription)
  .option('-f, --force', messages.cli.forceOptionDescription);

const handleCliError = (error: unknown) => {
  if (error instanceof DbUtilitySecurityError) {
    const text =
      error.code === 'UNSAFE_OPERATION'
        ? messages.cli.securitySqlUnsafeOperation
        : messages.cli.securitySqlUnsafeDataSelect;
    console.error(messages.cli.securityError, text);
  } else if (error instanceof DbUtilityError) {
    let text: string;
    switch (error.code) {
      case 'INTROSPECTION_DB_TYPE_REQUIRED':
        text = messages.cli.introspectionDbTypeRequired;
        break;
      case 'INTROSPECTION_DB_TYPE_UNSUPPORTED':
        text = messages.cli.introspectionDbTypeUnsupported;
        break;
      case 'APP_CONFIG_FILE_NOT_FOUND':
        text = messages.cli.appConfigFileNotFound(error.details || '?');
        break;
      case 'APP_CONFIG_FILE_FORMAT_UNSUPPORTED':
        text = messages.cli.appConfigFileFormatUnsupported(error.details || '?');
        break;
      case 'CONFIG_FILE_NOT_FOUND':
        text = messages.cli.configFileNotFound(error.details || '?');
        break;
      case 'CONFIG_FILE_FORMAT_UNSUPPORTED':
        text = messages.cli.configFileFormatUnsupported(error.details || '?');
        break;
      case 'CONFIG_DB_TYPE_OR_CONNECTION_STRING_REQUIRED':
        text = messages.cli.configDbTypeOrConnectionStringRequired;
        break;
      case 'CONFIG_DB_TYPE_REQUIRED':
        text = messages.cli.configDbTypeRequired;
        break;
      case 'CONNECTION_FAILED':
        text = messages.cli.connectionFailed;
        break;
      default:
        text = error.message;
        break;
    }
    console.error(messages.cli.genericError, text);
  } else {
    console.error(
      messages.cli.genericError,
      error instanceof Error ? error.message : String(error),
    );
  }
  process.exit(1);
};

const addConnectionOptions = (cmd: Command) => {
  return cmd
    .option('-c, --config <path>', messages.cli.optionConfigPath)
    .option('-t, --type <type>', messages.cli.optionType)
    .option('-H, --host <host>', messages.cli.optionHost)
    .option('-P, --port <port>', messages.cli.optionPort)
    .option('-u, --username <username>', messages.cli.optionUsername)
    .option('-p, --password <password>', messages.cli.optionPassword)
    .option('-d, --database <database>', messages.cli.optionDatabase)
    .option('--ssl', messages.cli.optionSsl);
};

interface CliOptions {
  config?: string;
  type?: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
}

const getConnectionConfig = async (options: CliOptions): Promise<DatabaseConfig> => {
  const overrides: Partial<DatabaseConfig> = {};

  if (options.type) overrides.type = options.type as DatabaseType;
  if (options.host) overrides.host = options.host;
  if (options.port) overrides.port = parseInt(options.port, 10);
  if (options.username) overrides.username = options.username;
  if (options.password) overrides.password = options.password;
  if (options.database) overrides.database = options.database;
  if (options.ssl) overrides.ssl = true;

  return ConfigLoader.load(options.config, overrides);
};

const connectCommand = program.command('connect').description(messages.cli.connectDescription);

addConnectionOptions(connectCommand).action(async (options: CliOptions) => {
  try {
    console.log(messages.cli.loadingConfig);
    const config = await getConnectionConfig(options);

    console.log(messages.cli.connecting(config.type));
    const connection = ConnectionFactory.create(config);

    await connection.connect();
    console.log(messages.cli.connectSuccess);

    await connection.disconnect();
    console.log(messages.cli.connectionClosed);
  } catch (error) {
    handleCliError(error);
  }
});

const introspectCommand = program
  .command('introspect')
  .description(messages.cli.introspectDescription);

addConnectionOptions(introspectCommand).action(async (options: CliOptions) => {
  try {
    const config = await getConnectionConfig(options);
    console.log(messages.cli.introspectConnecting(config.database));

    const service = new IntrospectionService(config);
    const schema = await service.introspect();

    const runDir = IntrospectionLogger.logSchema(config, schema, process.cwd(), appConfig);

    console.log(messages.cli.introspectDone(schema.tables.length));
    console.log(messages.cli.introspectSavedAt(runDir));
  } catch (error) {
    handleCliError(error);
  }
});

const exportCommand = program.command('export').description(messages.cli.exportDescription);

addConnectionOptions(exportCommand).action(async (options: CliOptions) => {
  try {
    const config = await getConnectionConfig(options);
    console.log(messages.cli.introspectConnecting(config.database));
    console.log(messages.cli.exportDevMessage);
  } catch (error) {
    handleCliError(error);
  }
});

const migrateCommand = program.command('migrate').description(messages.cli.migrateDescription);

addConnectionOptions(migrateCommand).action(async (options) => {
  try {
    const config = await getConnectionConfig(options);
    console.log(messages.cli.introspectConnecting(config.database));
    console.log(messages.cli.migrateDevMessage);
  } catch (error) {
    handleCliError(error);
  }
});

program.parse(process.argv);

const rootOptions = program.opts() as { init?: boolean; force?: boolean };
const hasSubCommand = program.args && program.args.length > 0;

if (rootOptions.init && !hasSubCommand) {
  const result = ConfigInitializer.init(process.cwd(), rootOptions.force === true);
  if (result.recreated) {
    console.log(messages.cli.initRecreated(result.path));
  } else if (result.created) {
    console.log(messages.cli.initCreated(result.path));
  } else {
    console.log(messages.cli.initAlreadyExists(result.path));
  }
}

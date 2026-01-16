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
import { GeneratorWriter } from '../generators/GeneratorWriter';
import { MongooseGenerator } from '../generators/MongooseGenerator';
import { PrismaGenerator } from '../generators/PrismaGenerator';
import { SequelizeGenerator } from '../generators/SequelizeGenerator';
import { TypeORMGenerator } from '../generators/TypeORMGenerator';
import { getMessages } from '../i18n/messages';
import { IntrospectionLogger } from '../introspection/IntrospectionLogger';
import { IntrospectionService } from '../introspection/IntrospectionService';
import { DatabaseConfig, DatabaseType, IDatabaseConnector } from '../types/database';

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
  target?: string;
  output?: string;
}

const getGenerator = (target: string) => {
  switch (target.toLowerCase()) {
    case 'sequelize':
      return new SequelizeGenerator();
    case 'typeorm':
      return new TypeORMGenerator();
    case 'prisma':
      return new PrismaGenerator();
    case 'mongoose':
    case 'mongodb':
      return new MongooseGenerator();
    default:
      throw new Error(`Unknown target: ${target}`);
  }
};

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

const withConnection = async (
  options: CliOptions,
  action: (connector: IDatabaseConnector, config: DatabaseConfig) => Promise<void>,
) => {
  let connector: IDatabaseConnector | null = null;
  try {
    const config = await getConnectionConfig(options);
    console.log(messages.cli.connecting(config.type));
    
    connector = ConnectionFactory.create(config);
    await connector.connect();
    
    await action(connector, config);
  } catch (error) {
    handleCliError(error);
  } finally {
    if (connector) {
      try {
        await connector.disconnect();
        console.log(messages.cli.connectionClosed);
      } catch (disconnectError) {
        // Ignora erros de desconexão se já houve erro principal ou conexão já fechada
        console.warn('Erro ao fechar conexão:', disconnectError instanceof Error ? disconnectError.message : String(disconnectError));
      }
    }
  }
};

const connectCommand = program.command('connect').description(messages.cli.connectDescription);

addConnectionOptions(connectCommand).action(async (options: CliOptions) => {
  await withConnection(options, async () => {
    console.log(messages.cli.connectSuccess);
  });
});

const introspectCommand = program
  .command('introspect')
  .description(messages.cli.introspectDescription);

addConnectionOptions(introspectCommand).action(async (options: CliOptions) => {
  await withConnection(options, async (connector, config) => {
    console.log(messages.cli.introspectConnecting(config.database));

    const service = new IntrospectionService(connector, config);
    const schema = await service.introspect();

    const runDir = IntrospectionLogger.logSchema(config, schema, process.cwd(), appConfig);

    console.log(messages.cli.introspectDone(schema.tables.length));
    console.log(messages.cli.introspectSavedAt(runDir));
  });
});

const exportCommand = program.command('export').description(messages.cli.exportDescription);

addConnectionOptions(exportCommand)
  .option('--target <target>', 'Target ORM: sequelize, typeorm, prisma, mongoose')
  .option('--output <dir>', 'Output directory')
  .action(async (options: CliOptions) => {
    if (!options.target) {
      handleCliError(new Error('Target is required (--target <target>)'));
      return;
    }

    await withConnection(options, async (connector, config) => {
      console.log(messages.cli.introspectConnecting(config.database));

      const service = new IntrospectionService(connector, config);
      const schema = await service.introspect();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const generator = getGenerator(options.target!);
      console.log(`Generating models for ${options.target}...`);

      const files = await generator.generate(schema);
      const outputDir = options.output || join(process.cwd(), 'generated-models');

      GeneratorWriter.write(files, outputDir);
      console.log(`Successfully generated ${files.length} files in ${outputDir}`);
    });
  });

const migrateCommand = program.command('migrate').description(messages.cli.migrateDescription);

addConnectionOptions(migrateCommand)
  .option('--target <target>', 'Target ORM: sequelize, typeorm')
  .option('--output <dir>', 'Output directory')
  .action(async (options) => {
    if (!options.target) {
      handleCliError(new Error('Target is required (--target <target>)'));
      return;
    }

    await withConnection(options, async (connector, config) => {
      console.log(messages.cli.introspectConnecting(config.database));

      const service = new IntrospectionService(connector, config);
      const schema = await service.introspect();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const generator = getGenerator(options.target!);
      if (!('generateMigrations' in generator)) {
        throw new Error(`Target ${options.target} does not support migration generation`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const migrationGenerator = generator as any;

      console.log(`Generating migrations for ${options.target}...`);
      const files = await migrationGenerator.generateMigrations(schema);

      const outputDir = options.output || join(process.cwd(), 'generated-migrations');
      GeneratorWriter.write(files, outputDir);
      console.log(`Successfully generated ${files.length} migration files in ${outputDir}`);
    });
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

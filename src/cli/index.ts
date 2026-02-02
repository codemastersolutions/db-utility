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
import { DataMigrationGenerator } from '../generators/GeneratorTypes';
import { MongooseGenerator } from '../generators/MongooseGenerator';
import { PrismaGenerator } from '../generators/PrismaGenerator';
import { SequelizeGenerator } from '../generators/SequelizeGenerator';
import { TypeORMGenerator } from '../generators/TypeORMGenerator';
import { getMessages } from '../i18n/messages';
import { DataExtractor } from '../introspection/DataExtractor';
import { IntrospectionLogger } from '../introspection/IntrospectionLogger';
import { IntrospectionService } from '../introspection/IntrospectionService';
import { ContainerManager } from '../testing/ContainerManager';
import { MigrationTester } from '../testing/MigrationTester';
import { DatabaseConfig, DatabaseType, IDatabaseConnector } from '../types/database';

const appConfig = AppConfigLoader.load();
const messages = getMessages(appConfig.language);

import { resolveMigrationOutputDir } from './helpers';

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
  .option('-f, --force', messages.cli.forceOptionDescription)
  .action(() => {
    // No-op action to prevent help display when only options are passed
  });

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
      case 'CONNECTION_CONFIG_NOT_FOUND':
        text = messages.cli.connectionConfigNotFound(error.details || '?');
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
    .option('--conn <name>', messages.cli.optionConnectionName)
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
  conn?: string;
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
  data?: boolean;
  tables?: string;
  onlyData?: boolean;
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

  return ConfigLoader.load(options.config, overrides, options.conn);
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
        console.warn(
          'Erro ao fechar conexão:',
          disconnectError instanceof Error ? disconnectError.message : String(disconnectError),
        );
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

      const generator = getGenerator(options.target!);
      console.log(`Generating models for ${options.target}...`);

      const files = await generator.generate(schema);
      const baseOutputDir = options.output || join(process.cwd(), 'exports', 'generated-models');
      const outputDir = join(baseOutputDir, options.target!.toLowerCase());

      GeneratorWriter.write(files, outputDir);
      console.log(`Successfully generated ${files.length} files in ${outputDir}`);
    });
  });

const migrateCommand = program.command('migrations').description(messages.cli.migrateDescription);

addConnectionOptions(migrateCommand)
  .option('--target <target>', 'Target ORM: sequelize, typeorm')
  .option('--output <dir>', 'Output directory')
  .option('--data', 'Generate data migration')
  .option('--only-data', 'Generate only data migration')
  .option('--tables <tables>', 'Comma separated list of tables to export data from')
  .action(async (options: CliOptions) => {
    if (!options.target) {
      handleCliError(new Error('Target is required (--target <target>)'));
      return;
    }

    await withConnection(options, async (connector, config) => {
      console.log(messages.cli.introspectConnecting(config.database));

      const service = new IntrospectionService(connector, config);
      const schema = await service.introspect();

      const generator = getGenerator(options.target!);

      // Logic:
      // --only-data: Generate ONLY data migrations (no schema)
      // --data: Generate BOTH schema AND data migrations
      // (default): Generate ONLY schema migrations

      const generateData = options.onlyData || options.data;
      const generateSchema = !options.onlyData;

      let extractedData: any[] = [];
      if (generateData) {
        const tables = options.tables ? options.tables.split(',').map((t) => t.trim()) : [];
        if (tables.length === 0) {
          throw new Error(
            'You must specify at least one table via --tables when using --data or --only-data',
          );
        }

        console.log(`Extracting data from tables: ${tables.join(', ')}...`);
        const extractor = new DataExtractor(connector, config.type);
        extractedData = await extractor.extract(schema, tables);
      }

      // Save database info
      const version = await connector.getVersion();
      const dbInfo = {
        type: config.type,
        version: version,
        databaseName: config.database,
        timestamp: new Date().toISOString(),
      };

      // Priority: Flag > Config > Default
      const baseOutputDir = resolveMigrationOutputDir(process.cwd(), options.output, appConfig);

      const outputDir = join(baseOutputDir, options.target!.toLowerCase());

      if (generateSchema) {
        if (!('generateMigrations' in generator)) {
          throw new Error(`Target ${options.target} does not support migration generation`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const migrationGenerator = generator as any;

        console.log(`Generating migrations for ${options.target}...`);
        // Pass extractedData if available (interleaved generation)
        // If generateData is true but we are here, it means we are in the "both" case (options.data)
        // If options.onlyData is true, generateSchema is false, so we won't be here.
        const files = await migrationGenerator.generateMigrations(
          schema,
          options.data ? extractedData : undefined,
        );

        GeneratorWriter.clean(outputDir);
        GeneratorWriter.write(files, outputDir);

        // Write database info
        GeneratorWriter.write(
          [
            {
              fileName: 'database-info.json',
              content: JSON.stringify(dbInfo, null, 2),
            },
          ],
          outputDir,
        );

        console.log(`Successfully generated ${files.length} migration files in ${outputDir}`);
      } else if (generateData) {
        // Only data generation (options.onlyData is true)
        if (!('generateDataMigrations' in generator)) {
          throw new Error(`Target ${options.target} does not support data migration generation`);
        }

        console.log(`Generating data migrations for ${options.target}...`);
        const dataMigrationGenerator = generator as unknown as DataMigrationGenerator;
        const files = await dataMigrationGenerator.generateDataMigrations(extractedData);

        GeneratorWriter.clean(outputDir);
        GeneratorWriter.write(files, outputDir);

        // Write database info
        GeneratorWriter.write(
          [
            {
              fileName: 'database-info.json',
              content: JSON.stringify(dbInfo, null, 2),
            },
          ],
          outputDir,
        );

        console.log(`Successfully generated ${files.length} seed files in ${outputDir}`);
      }
    });
  });

const testCommand = program.command('test').description('Test generated migrations');

testCommand
  .option('--target <target>', 'Target ORM: sequelize, typeorm')
  .option('--dir <dir>', 'Migrations directory')
  .option(
    '--engines <engines>',
    'Comma separated list of engines to test (e.g. postgres:14,mysql:8)',
  )
  .option('--backup', 'Export database backup from container')
  .action(
    async (options: { target?: string; dir?: string; engines?: string; backup?: boolean }) => {
      if (!options.target) {
        handleCliError(new Error('Target is required (--target <target>)'));
        return;
      }

      const migrationsDir =
        options.dir ||
        join(process.cwd(), 'exports', 'generated-migrations', options.target.toLowerCase());

      const engines = options.engines ? options.engines.split(',').map((e) => e.trim()) : undefined;

      const containerManager = new ContainerManager();
      const tester = new MigrationTester(containerManager);

      try {
        await tester.test(options.target, migrationsDir, engines, options.backup);
      } catch (error) {
        handleCliError(error);
      }
    },
  );

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

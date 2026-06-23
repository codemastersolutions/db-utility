#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppConfigLoader } from '../config/AppConfig';
import { ConfigInitializer } from '../config/ConfigInitializer';
import { ConfigLoader } from '../config/ConfigLoader';
import { ConnectionFactory } from '../database/ConnectionFactory';
import { DbUtilitySecurityError } from '../database/SqlSafety';
import { DbUtilityError } from '../errors/DbUtilityError';
import { GeneratorWriter } from '../generators/GeneratorWriter';
import {
  DataMigrationGenerator,
  MigrationGenerationOptions,
  MigrationGenerator,
} from '../generators/GeneratorTypes';
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
import { ModelTester } from '../testing/ModelTester';
import { DatabaseConfig, DatabaseType, IDatabaseConnector } from '../types/database';

const appConfig = AppConfigLoader.load();
const messages = getMessages(appConfig.language);

import { VersionChecker } from './VersionChecker';
import {
  buildIntrospectionWarnings,
  resolveDisableForeignKeys,
  resolveMigrationOutputDir,
} from './helpers';

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
  .version(getPackageVersion(), '-v, --version');

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
      case 'CONFIG_DB_CONNECT_TIMEOUT_INVALID':
        text = messages.cli.configDbConnectTimeoutInvalid(error.details || '?');
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
    .option('--ssl', messages.cli.optionSsl)
    .option('--connect-timeout <ms>', messages.cli.optionConnectTimeout);
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
  connectTimeout?: string;
  target?: string;
  output?: string;
  data?: boolean;
  tables?: string;
  onlyData?: boolean;
  test?: boolean;
  disableForeignKeys?: boolean;
}

const runTest = async (options: {
  target?: string;
  dir?: string;
  engines?: string;
  backup?: boolean;
}) => {
  const target = options.target || appConfig.target;
  if (!target) {
    throw new Error('Target is required (use --target or config.target)');
  }

  let migrationsDir: string;
  if (options.dir) {
    migrationsDir = options.dir;
  } else {
    const baseOutputDir = resolveMigrationOutputDir(process.cwd(), undefined, appConfig);
    migrationsDir = join(baseOutputDir, target.toLowerCase());
  }

  const engines = options.engines ? options.engines.split(',').map((e) => e.trim()) : undefined;

  const containerManager = new ContainerManager();
  const tester = new MigrationTester(containerManager);

  const backup = options.backup ?? appConfig.migrations.backup;
  await tester.test(target, migrationsDir, engines, backup);
};

const printIntrospectionWarnings = (schema: Parameters<typeof buildIntrospectionWarnings>[0]) => {
  const warnings = buildIntrospectionWarnings(schema, messages.cli);
  warnings.forEach((warning) => console.warn(warning));
};

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
  if (options.port) overrides.port = Number.parseInt(options.port, 10);
  if (options.username) overrides.username = options.username;
  if (options.password) overrides.password = options.password;
  if (options.database) overrides.database = options.database;
  if (options.ssl) overrides.ssl = true;
  if (options.connectTimeout)
    overrides.connectTimeoutMs = Number.parseInt(options.connectTimeout, 10);

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
    printIntrospectionWarnings(schema);
  });
});

const exportCommand = program
  .command('models')
  .alias('model')
  .description(messages.cli.exportDescription);

addConnectionOptions(exportCommand)
  .option('--target <target>', 'Target ORM: sequelize, typeorm, prisma, mongoose')
  .option('--output <dir>', 'Output directory')
  .option('--test', 'Test generated models')
  .action(async (options: CliOptions) => {
    const target = options.target || appConfig.target;
    if (!target) {
      handleCliError(new Error('Target is required (use --target or config.target)'));
      return;
    }

    await withConnection(options, async (connector, config) => {
      console.log(messages.cli.introspectConnecting(config.database));

      const service = new IntrospectionService(connector, config);
      const schema = await service.introspect();
      printIntrospectionWarnings(schema);

      const generator = getGenerator(target);
      console.log(`Generating models for ${target}...`);

      const files = await generator.generate(schema);
      const baseOutputDir = options.output || join(process.cwd(), 'exports', 'models');
      const outputDir = join(baseOutputDir, target.toLowerCase());

      GeneratorWriter.write(files, outputDir);
      console.log(`Successfully generated ${files.length} files in ${outputDir}`);

      if (options.test) {
        const tester = new ModelTester(config);
        await tester.test(target, outputDir);
      }
    });
  });

const migrateCommand = program
  .command('migrations')
  .alias('migration')
  .alias('migrate')
  .description(messages.cli.migrateDescription);

addConnectionOptions(migrateCommand)
  .option('--target <target>', 'Target ORM: sequelize, typeorm')
  .option('--output <dir>', 'Output directory')
  .option('--data', 'Generate data migration')
  .option('--only-data', 'Generate only data migration')
  .option('--disable-foreign-keys', 'Disable foreign key migration generation')
  .option('--tables <tables>', 'Comma separated list of tables to export data from')
  .option('--test', 'Run tests after migration')
  .action(async (options: CliOptions) => {
    const target = options.target || appConfig.target;
    if (!target) {
      handleCliError(new Error('Target is required (use --target or config.target)'));
      return;
    }

    await withConnection(options, async (connector, config) => {
      console.log(messages.cli.introspectConnecting(config.database));

      const service = new IntrospectionService(connector, config);
      const schema = await service.introspect();
      printIntrospectionWarnings(schema);

      const generator = getGenerator(target);

      // Logic:
      // --only-data: Generate ONLY data migrations (no schema)
      // --data or config.data: Generate BOTH schema AND data migrations
      // (default): Generate ONLY schema migrations

      const isDataEnabled = options.data || appConfig.migrations.data;
      const generateData = options.onlyData || isDataEnabled;
      const generateSchema = !options.onlyData;
      const migrationOptions: MigrationGenerationOptions = {
        disableForeignKeys: resolveDisableForeignKeys(options.disableForeignKeys, appConfig),
      };

      let extractedData: any[] = [];
      if (generateData) {
        const tables = options.tables
          ? options.tables.split(',').map((t) => t.trim())
          : appConfig.migrations.dataTables || [];

        if (tables.length === 0) {
          throw new Error(
            'You must specify at least one table via --tables or config.migrations.dataTables when using --data or --only-data',
          );
        }

        const tableNames = tables.map((t) => (typeof t === 'string' ? t : t.table));
        console.log(`Extracting data from tables: ${tableNames.join(', ')}...`);
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

      const outputDir = join(baseOutputDir, target.toLowerCase());

      if (generateSchema) {
        if (!('generateMigrations' in generator)) {
          throw new Error(`Target ${target} does not support migration generation`);
        }

        const migrationGenerator = generator as MigrationGenerator;

        console.log(`Generating migrations for ${target}...`);
        // Pass extractedData if available (interleaved generation)
        // If generateData is true but we are here, it means we are in the "both" case (options.data)
        // If options.onlyData is true, generateSchema is false, so we won't be here.
        const files = await migrationGenerator.generateMigrations(
          schema,
          isDataEnabled ? extractedData : undefined,
          migrationOptions,
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

        // Identity handling is embedded in the generated seed migrations

        console.log(`Successfully generated ${files.length} migration files in ${outputDir}`);
      } else if (generateData) {
        // Only data generation (options.onlyData is true)
        if (!('generateDataMigrations' in generator)) {
          throw new Error(`Target ${target} does not support data migration generation`);
        }

        console.log(`Generating data migrations for ${target}...`);
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

        // Identity handling is embedded in the generated seed migrations

        console.log(`Successfully generated ${files.length} seed files in ${outputDir}`);
      }
    });

    if (options.test) {
      const baseOutputDir = resolveMigrationOutputDir(process.cwd(), options.output, appConfig);
      const outputDir = join(baseOutputDir, target.toLowerCase());

      console.log('\nStarting tests...');
      try {
        await runTest({
          target,
          dir: outputDir,
        });
      } catch (error) {
        handleCliError(error);
      }
    }
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
      try {
        await runTest(options);
      } catch (error) {
        handleCliError(error);
      }
    },
  );

(async () => {
  const checker = new VersionChecker(getPackageVersion(), appConfig.versionCheck);
  const shouldContinue = await checker.check();

  if (!shouldContinue) {
    return;
  }

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
  } else if (!hasSubCommand) {
    program.help({ error: false });
  }
})();

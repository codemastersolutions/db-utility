#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ConfigLoader } from '../config/ConfigLoader';
import { ConnectionFactory } from '../database/ConnectionFactory';
import { DatabaseConfig, DatabaseType } from '../types/database';

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
  .description('O mais poderoso utilitário de banco de dados.')
  .version(getPackageVersion());

// Definição de opções comuns
const addConnectionOptions = (cmd: Command) => {
  return cmd
    .option('-c, --config <path>', 'Caminho para o arquivo de configuração')
    .option('-t, --type <type>', 'Tipo de banco de dados (mysql, postgres, mssql)')
    .option('-H, --host <host>', 'Host do banco de dados')
    .option('-P, --port <port>', 'Porta do banco de dados')
    .option('-u, --username <username>', 'Usuário do banco de dados')
    .option('-p, --password <password>', 'Senha do banco de dados')
    .option('-d, --database <database>', 'Nome do banco de dados')
    .option('--ssl', 'Habilitar SSL');
};

const getConnectionConfig = async (options: any): Promise<DatabaseConfig> => {
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

const connectCommand = program.command('connect').description('Conectar ao banco de dados');

addConnectionOptions(connectCommand).action(async (options) => {
  try {
    console.log('Carregando configuração...');
    const config = await getConnectionConfig(options);

    console.log(`Tentando conectar ao banco de dados ${config.type}...`);
    const connection = ConnectionFactory.create(config);

    await connection.connect();
    console.log('✅ Conexão estabelecida com sucesso!');

    await connection.disconnect();
    console.log('Conexão encerrada.');
  } catch (error) {
    console.error('❌ Erro ao conectar:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
});

const introspectCommand = program
  .command('introspect')
  .description('Realizar introspecção no banco de dados');

addConnectionOptions(introspectCommand).action(async (options) => {
  try {
    const config = await getConnectionConfig(options);
    console.log(`Conectando para introspecção em ${config.database}...`);
    console.log('Funcionalidade de introspecção em desenvolvimento.');
  } catch (error) {
    console.error('❌ Erro:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
});

const exportCommand = program
  .command('export')
  .description('Exportar models (Sequelize, TypeORM, Prisma)');

addConnectionOptions(exportCommand).action(async (options) => {
  try {
    const config = await getConnectionConfig(options);
    console.log(`Conectando para exportação em ${config.database}...`);
    console.log('Funcionalidade de exportação em desenvolvimento.');
  } catch (error) {
    console.error('❌ Erro:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
});

const migrateCommand = program
  .command('migrate')
  .description('Gerar migrations a partir do banco de dados');

addConnectionOptions(migrateCommand).action(async (options) => {
  try {
    const config = await getConnectionConfig(options);
    console.log(`Conectando para migration em ${config.database}...`);
    console.log('Funcionalidade de migration em desenvolvimento.');
  } catch (error) {
    console.error('❌ Erro:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
});

program.parse(process.argv);

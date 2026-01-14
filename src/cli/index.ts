#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';

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
  .description('O mais poderoso utilitário de banco de dados.')
  .version(getPackageVersion());

program
  .command('connect')
  .description('Conectar ao banco de dados')
  .action(() => {
    console.log('Funcionalidade de conexão em desenvolvimento.');
  });

program
  .command('introspect')
  .description('Realizar introspecção no banco de dados')
  .action(() => {
    console.log('Funcionalidade de introspecção em desenvolvimento.');
  });

program
  .command('export')
  .description('Exportar models (Sequelize, TypeORM, Prisma)')
  .action(() => {
    console.log('Funcionalidade de exportação em desenvolvimento.');
  });

program
  .command('migrate')
  .description('Gerar migrations a partir do banco de dados')
  .action(() => {
    console.log('Funcionalidade de migration em desenvolvimento.');
  });

program.parse(process.argv);

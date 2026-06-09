import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseConfig } from '../types/database';

export class ModelTester {
  constructor(private readonly config: DatabaseConfig) {}

  async test(target: string, modelsDir: string) {
    const pkgManager = this.detectPackageManager();
    await this.checkAndInstallORM(target, pkgManager);

    console.log(`Testing models for ${target}...`);

    switch (target.toLowerCase()) {
      case 'sequelize':
        await this.testSequelize(modelsDir);
        break;
      case 'typeorm':
        await this.testTypeORM(modelsDir);
        break;
      case 'prisma':
        await this.testPrisma(modelsDir);
        break;
      default:
        throw new Error(`Testing not supported for ${target}`);
    }
  }

  private detectPackageManager(): string {
    if (existsSync('yarn.lock')) return 'yarn';
    if (existsSync('pnpm-lock.yaml')) return 'pnpm';
    return 'npm';
  }

  private async checkAndInstallORM(target: string, pkgManager: string) {
    const packageName = this.getPackageName(target);
    const isInstalled = this.isPackageInstalled(packageName);

    if (isInstalled) {
      console.log(`ORM ${packageName} is already installed.`);
      return;
    }

    // Dynamic import for inquirer (ESM module)
    const inquirer = (await import('inquirer')).default;

    const { install } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: `ORM ${packageName} is not installed. Do you want to install it?`,
        default: true,
      },
    ]);

    if (!install) {
      console.log('Aborting operation as ORM is required for testing.');
      process.exit(0);
    }

    const { version } = await inquirer.prompt([
      {
        type: 'input',
        name: 'version',
        message: `Which version of ${packageName} do you want to install? (Leave empty for latest)`,
        default: '',
      },
    ]);

    const installCmd = this.getInstallCommand(pkgManager, packageName, version);
    console.log(`Installing ${packageName}...`);
    try {
      execSync(installCmd, { stdio: 'inherit' });
      console.log(`Successfully installed ${packageName}.`);
    } catch (error) {
      console.error(`Failed to install ${packageName}.`);
      throw error;
    }
  }

  private getPackageName(target: string): string {
    switch (target.toLowerCase()) {
      case 'sequelize':
        return 'sequelize';
      case 'typeorm':
        return 'typeorm';
      case 'prisma':
        return 'prisma';
      case 'mongoose':
        return 'mongoose';
      default:
        throw new Error(`Unknown target: ${target}`);
    }
  }

  private isPackageInstalled(packageName: string): boolean {
    // Check local package.json
    if (existsSync('package.json')) {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps[packageName]) return true;
    }

    // Check global (optional, but requested)
    try {
      execSync(`npm list -g ${packageName}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private getInstallCommand(pkgManager: string, packageName: string, version: string): string {
    const pkgWithVersion = version ? `${packageName}@${version}` : packageName;
    switch (pkgManager) {
      case 'yarn':
        return `yarn add ${pkgWithVersion}`;
      case 'pnpm':
        return `pnpm add ${pkgWithVersion}`;
      default:
        return `npm install ${pkgWithVersion}`;
    }
  }

  private async testSequelize(modelsDir: string) {
    const testFile = join(modelsDir, 'test-sequelize-models.ts');

    // We need to list all model files to import them
    // Assuming modelsDir contains .ts files for models
    // But we need to run this script. If we use ts-node, we can import .ts.

    const script = `
import { Sequelize, DataTypes } from 'sequelize';
import * as fs from 'fs';
import * as path from 'path';

// Config
const config = ${JSON.stringify(this.config)};

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.type as any,
  logging: false,
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');

    // Find all model files
    const files = fs.readdirSync('${modelsDir}').filter(f => f.endsWith('.ts') && f !== 'test-sequelize-models.ts');

    for (const file of files) {
      const modelName = path.basename(file, '.ts');
      console.log(\`Testing model: \${modelName}\`);

      // Dynamic import of the model
      // Note: In generated models, we export a class and an init function.
      // We need to import the file.
      // Since we are running this script with ts-node, we can use require or import.

      const modelModule = require(path.join('${modelsDir}', file));

      // Check if it has init function
      if (typeof modelModule.init === 'function') {
        const Model = modelModule.init(sequelize);

        // Try a simple query
        try {
          const count = await Model.count();
          console.log(\`✅ \${modelName}: Count query successful (Rows: \${count})\`);

          const item = await Model.findOne();
          if (item) {
             console.log(\`   Sample data: \${JSON.stringify(item.toJSON())}\`);
          }
        } catch (err) {
          console.error(\`❌ \${modelName}: Query failed\`, err);
        }
      } else {
        console.warn(\`⚠️ \${modelName}: No init function found\`);
      }
    }

  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
    `;

    writeFileSync(testFile, script);

    console.log(`Running test script: ${testFile}`);
    try {
      // Execute with ts-node
      // We assume ts-node is available or we use npx
      execSync(`npx ts-node "${testFile}"`, { stdio: 'inherit' });
    } finally {
      if (existsSync(testFile)) {
        unlinkSync(testFile);
      }
    }
  }

  private async testTypeORM(modelsDir: string) {
    const testFile = join(modelsDir, 'test-typeorm-models.ts');

    const script = `
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

// Config
const config = ${JSON.stringify(this.config)};

// Load entities
// We need to import all entity classes
const files = fs.readdirSync('${modelsDir}').filter(f => f.endsWith('.ts') && f !== 'test-typeorm-models.ts');
const entities = files.map(f => require(path.join('${modelsDir}', f))[path.basename(f, '.ts')]);

const dataSource = new DataSource({
  type: config.type as any,
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
  database: config.database,
  entities: entities,
  synchronize: false,
  logging: false,
});

async function run() {
  try {
    await dataSource.initialize();
    console.log('Data Source has been initialized!');

    for (const entity of entities) {
      const metadata = dataSource.getMetadata(entity);
      const tableName = metadata.tableName;
      console.log(\`Testing entity: \${metadata.name} (Table: \${tableName})\`);

      try {
        const repo = dataSource.getRepository(entity);
        const count = await repo.count();
        console.log(\`✅ \${metadata.name}: Count query successful (Rows: \${count})\`);

        const item = await repo.findOne({ where: {} });
        if (item) {
           console.log(\`   Sample data: \${JSON.stringify(item)}\`);
        }
      } catch (err) {
        console.error(\`❌ \${metadata.name}: Query failed\`, err);
      }
    }

  } catch (error) {
    console.error('Error during Data Source initialization', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();
    `;

    writeFileSync(testFile, script);

    console.log(`Running test script: ${testFile}`);
    try {
      execSync(`npx ts-node "${testFile}"`, { stdio: 'inherit' });
    } finally {
      if (existsSync(testFile)) {
        unlinkSync(testFile);
      }
    }
  }

  private async testPrisma(modelsDir: string) {
    // Prisma requires generation first
    console.log('Running prisma generate...');
    // schema.prisma should be in modelsDir
    const schemaPath = join(modelsDir, 'schema.prisma');
    if (!existsSync(schemaPath)) {
      throw new Error(`schema.prisma not found in ${modelsDir}`);
    }

    try {
      execSync(`npx prisma generate --schema="${schemaPath}"`, { stdio: 'inherit' });
    } catch (e) {
      console.error('Failed to generate prisma client');
      throw e;
    }

    const testFile = join(modelsDir, 'test-prisma-models.ts');

    // Need to parse schema to get model names or inspect PrismaClient
    // We can inspect the PrismaClient instance

    const script = `
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$connect();
    console.log('Connected to database via Prisma');

    // Get all model names from Prisma Client internals (dmmf)
    // Accessing internal property _dmmf
    // @ts-ignore
    const models = prisma._dmmf.datamodel.models;

    for (const model of models) {
      const modelName = model.name;
      console.log(\`Testing model: \${modelName}\`);

      try {
        // @ts-ignore
        const delegate = prisma[modelName.toLowerCase()]; // Prisma client uses lowercase or camelCase? Usually lowerCamelCase

        if (!delegate) {
           // Try exact name if needed
           // @ts-ignore
           delegate = prisma[modelName];
        }

        if (delegate) {
           const count = await delegate.count();
           console.log(\`✅ \${modelName}: Count query successful (Rows: \${count})\`);

           const item = await delegate.findFirst();
           if (item) {
              console.log(\`   Sample data: \${JSON.stringify(item)}\`);
           }
        } else {
           console.warn(\`⚠️ Could not find delegate for \${modelName}\`);
        }
      } catch (err) {
        console.error(\`❌ \${modelName}: Query failed\`, err);
      }
    }

  } catch (error) {
    console.error('Prisma error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
    `;

    writeFileSync(testFile, script);

    console.log(`Running test script: ${testFile}`);
    try {
      execSync(`npx ts-node "${testFile}"`, { stdio: 'inherit' });
    } finally {
      if (existsSync(testFile)) {
        unlinkSync(testFile);
      }
    }
  }
}

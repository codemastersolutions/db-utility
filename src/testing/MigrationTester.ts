import { join } from 'path';
import { existsSync, readFileSync, mkdirSync, chmodSync } from 'fs';
import { ContainerManager } from './ContainerManager';
import { MigrationRunner } from './runners/MigrationRunner';
import { SequelizeRunner } from './runners/SequelizeRunner';
import { TypeORMRunner } from './runners/TypeORMRunner';
import { DatabaseType, DatabaseConfig } from '../types/database';
import { ConnectionFactory } from '../database/ConnectionFactory';
import { PackageManager, InstallScope } from '../utils/PackageManager';

interface TestResult {
  engine: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

interface InstallConfig {
  versions: string[];
  shouldInstall: boolean;
  scope: InstallScope;
  shouldUninstall: boolean;
}

export class MigrationTester {
  private containerManager: ContainerManager;
  private packageManager: PackageManager;

  constructor(containerManager?: ContainerManager) {
    this.containerManager = containerManager || new ContainerManager();
    this.packageManager = new PackageManager();
  }

  async test(
    target: string,
    migrationsDir: string,
    engines?: string[],
    backup?: boolean,
  ): Promise<void> {
    const hasDocker = await this.containerManager.checkDocker();
    if (!hasDocker) {
      console.error('Docker not found. Skipping migration tests.');
      return;
    }

    // Determine engines to test
    let testEngines: {
      type: DatabaseType;
      version: string;
      originalString?: string;
      databaseName?: string;
    }[] = [];

    if (engines && engines.length > 0) {
      testEngines = engines.map((e) => {
        const parts = e.split(':');
        return {
          type: this.mapType(parts[0]),
          version: parts[1] || 'latest',
        };
      });
    } else {
      // Try to load from database-info.json
      const infoPath = join(migrationsDir, 'database-info.json');
      if (existsSync(infoPath)) {
        try {
          const info = JSON.parse(readFileSync(infoPath, 'utf-8'));
          if (info.type) {
            testEngines.push({
              type: info.type,
              version: info.version ? this.extractVersionNumber(info.version) : 'latest',
              originalString: info.version,
              databaseName: info.databaseName,
            });
          }
        } catch (e) {
          console.warn('Failed to parse database-info.json', e);
        }
      }
    }

    if (testEngines.length === 0) {
      console.error('No database engines specified and no database-info.json found.');
      return;
    }

    let installConfig: InstallConfig;
    try {
      installConfig = await this.ensureOrmInstalled(target);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      return;
    }

    const results: TestResult[] = [];

    for (const version of installConfig.versions) {
      if (installConfig.shouldInstall && version !== 'current') {
        try {
          await this.packageManager.install(target, { scope: installConfig.scope, version });
        } catch (e) {
          console.error(`Failed to install ${target}@${version}:`, e);
          continue;
        }
      }

      let ormPath: string | undefined;
      if (installConfig.scope === 'global') {
        try {
          const globalPath = await this.packageManager.getGlobalInstallPath();
          ormPath = join(globalPath, target);
        } catch (e) {
          console.warn('Could not determine global install path', e);
        }
      }

      let versionLabel = version;
      if (version === 'current') {
        const scopeToCheck = installConfig.scope === 'global' ? 'global' : 'local';
        const installedVersion = await this.packageManager.getInstalledVersion(
          target,
          scopeToCheck,
        );
        versionLabel = installedVersion || 'detected';
      }

      console.log(`\n=== Running tests with ${target} v${versionLabel} ===`);

      for (const engine of testEngines) {
        console.log(`Testing against ${engine.type} ${engine.version}...`);
        const result = await this.runTest(target, migrationsDir, engine, ormPath, backup);
        result.engine = `${result.engine} (${target} v${versionLabel})`;
        results.push(result);
      }

      if (installConfig.shouldUninstall && version !== 'current') {
        try {
          await this.packageManager.uninstall(target, installConfig.scope);
        } catch (e) {
          console.error(`Failed to uninstall ${target}:`, e);
        }
      }
    }

    this.printReport(results);
  }

  private async ensureOrmInstalled(target: string): Promise<InstallConfig> {
    const isInstalledLocal = await this.packageManager.isInstalled(target, 'local');
    const isInstalledGlobal = await this.packageManager.isInstalled(target, 'global');

    if (isInstalledLocal || isInstalledGlobal) {
      // If installed, we just run once with "current" version
      return {
        versions: ['current'],
        shouldInstall: false,
        scope: isInstalledLocal ? 'dependencies' : 'global',
        shouldUninstall: false,
      };
    }

    // Dynamic import for inquirer
    const inquirer = (await import('inquirer')).default;

    const { install } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: `ORM - ${target} não encontrado. Deseja instalar?`,
        default: true,
      },
    ]);

    if (!install) {
      throw new Error(`${target} is required to run tests.`);
    }

    const { scope, versionInput } = await inquirer.prompt([
      {
        type: 'list',
        name: 'scope',
        message: 'Local de instalação:',
        choices: [
          { name: 'Global (Padrão)', value: 'global' },
          { name: 'Dependencies', value: 'dependencies' },
          { name: 'Dev Dependencies', value: 'devDependencies' },
        ],
        default: 'global',
      },
      {
        type: 'input',
        name: 'versionInput',
        message: 'Versão desejada (ex: 6, 6.1, 6.1.5). Para matriz, separe por vírgula (ex: 6, 7):',
        validate: (input) => (input.trim().length > 0 ? true : 'Informe a versão.'),
      },
    ]);

    const versionsInput = versionInput.split(',').map((v: string) => v.trim());
    const versions: string[] = [];

    for (const v of versionsInput) {
      const resolved = await this.packageManager.resolveVersion(target, v);
      if (!resolved) {
        throw new Error(`Versão ${v} não encontrada para ${target}.`);
      }
      versions.push(resolved);
    }

    let shouldUninstall = false;
    if (scope === 'global' && versions.length === 1) {
      shouldUninstall = true;
    } else if (scope !== 'global' && versions.length === 1) {
      const { uninstall } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'uninstall',
          message: 'Deseja desinstalar o ORM após os testes?',
          default: true,
        },
      ]);
      shouldUninstall = uninstall;
    } else if (versions.length > 1) {
      shouldUninstall = true;
    }

    return { versions, shouldInstall: true, scope, shouldUninstall };
  }

  private mapType(input: string): DatabaseType {
    const lower = input.toLowerCase();
    if (lower.includes('postgres')) return 'postgres';
    if (lower.includes('mysql') || lower.includes('maria')) return 'mysql';
    if (lower.includes('sql') || lower.includes('mssql')) return 'mssql';
    return 'postgres'; // Default fallback
  }

  private extractVersionNumber(versionString: string): string {
    const match = versionString.match(/(\d+(\.\d+)?)/);
    return match ? match[1] : 'latest';
  }

  private getImageName(type: DatabaseType, version: string): string {
    if (type === 'postgres')
      return `postgres:${version === 'latest' ? 'latest' : version.split('.')[0]}`; // postgres:14
    if (type === 'mysql') return `mysql:${version === 'latest' ? 'latest' : version}`;
    if (type === 'mssql') {
      const v = version.includes('20') ? version.substring(0, 4) : '2022';
      return `mcr.microsoft.com/mssql/server:${v}-latest`;
    }
    return `postgres:latest`;
  }

  private getEnv(
    type: DatabaseType,
    password: string,
    dbName: string = 'testdb',
  ): Record<string, string> {
    if (type === 'postgres') return { POSTGRES_PASSWORD: password, POSTGRES_DB: dbName };
    if (type === 'mysql') return { MYSQL_ROOT_PASSWORD: password, MYSQL_DATABASE: dbName };
    if (type === 'mssql') return { ACCEPT_EULA: 'Y', MSSQL_SA_PASSWORD: password };
    return {};
  }

  private getFriendlyName(type: DatabaseType, version: string): string {
    const v = version === 'latest' ? '' : ` ${version}`;
    switch (type) {
      case 'postgres':
        return `Postgres${v}`;
      case 'mysql':
        return `MySQL${v}`;
      case 'mssql':
        return `Microsoft SQL Server${v}`;
      default:
        return `${type}${v}`;
    }
  }

  private async runTest(
    target: string,
    migrationsDir: string,
    engine: { type: DatabaseType; version: string; databaseName?: string },
    ormPath?: string,
    backup?: boolean,
  ): Promise<TestResult> {
    const startTime = Date.now();
    const password = 'StrongPassword123!';
    const port = Math.floor(Math.random() * (60000 - 10000) + 10000); // Random port
    const image = this.getImageName(engine.type, engine.version);
    const dbName = engine.databaseName || 'testdb';

    let containerId: string | null = null;

    try {
      console.log(`Starting container ${image} on port ${port}...`);
      let volumes: Record<string, string> | undefined;
      console.log('Backup flag:', backup);

      if (backup) {
        const friendlyName = this.getFriendlyName(engine.type, engine.version);
        const backupDir = join(process.cwd(), 'exports', 'backups', friendlyName);

        if (!existsSync(backupDir)) {
          mkdirSync(backupDir, { recursive: true });
        }
        try {
          chmodSync(backupDir, '777'); // Ensure container can write to it
        } catch (e) {
          console.warn(
            `Failed to chmod ${backupDir}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        volumes = { [backupDir]: '/backup' };
      }

      containerId = await this.containerManager.startContainer(
        image,
        this.getEnv(engine.type, password, dbName),
        port,
        engine.type === 'mssql' ? 1433 : engine.type === 'mysql' ? 3306 : 5432,
        volumes,
      );

      // Wait for DB to be ready
      const config: DatabaseConfig = {
        type: engine.type,
        host: 'localhost',
        port: port,
        username: engine.type === 'postgres' ? 'postgres' : engine.type === 'mysql' ? 'root' : 'sa',
        password: password,
        database: engine.type === 'mssql' ? 'master' : dbName, // MSSQL connects to master first
        ssl: false,
      };

      await this.waitForDb(config);

      // Create DB for MSSQL if needed (Postgres/MySQL create via env)
      if (engine.type === 'mssql') {
        const connector = ConnectionFactory.create(config);
        await connector.connect();
        if (dbName !== 'master') {
          await connector.query(`CREATE DATABASE [${dbName}]`, [], { bypassSafety: true });
        }
        await connector.disconnect();
        config.database = dbName;
      }

      // Run Migrations
      const runner = this.getRunner(target, ormPath);
      console.log(`Running migrations using ${target} runner...`);
      await runner.run(migrationsDir, config);

      if (backup && containerId) {
        console.log('Exporting database backup...');
        if (engine.type === 'mssql') {
          // Check for sqlcmd location (ODBC 18 uses mssql-tools18 and requires -C for TrustServerCertificate)
          let sqlCmdPath = '/opt/mssql-tools/bin/sqlcmd';
          let extraArgs = '';

          try {
            await this.containerManager.execInContainer(
              containerId,
              'ls /opt/mssql-tools18/bin/sqlcmd',
            );
            sqlCmdPath = '/opt/mssql-tools18/bin/sqlcmd';
            extraArgs = ' -C';
          } catch {
            // Fallback to default path if not found
          }

          await this.containerManager.execInContainer(
            containerId,
            `${sqlCmdPath} -S localhost -U sa${extraArgs} -Q "BACKUP DATABASE [${dbName}] TO DISK = '/backup/${dbName}.bak'"`,
            { SQLCMDPASSWORD: password },
          );
        } else if (engine.type === 'mysql') {
          await this.containerManager.execInContainer(
            containerId,
            `sh -c "mysqldump -u root -p'${password}' ${dbName} > /backup/${dbName}.sql"`,
          );
        } else if (engine.type === 'postgres') {
          await this.containerManager.execInContainer(
            containerId,
            `sh -c "pg_dump -U postgres ${dbName} > /backup/${dbName}.sql"`,
            { PGPASSWORD: password },
          );
        }
        console.log(
          `Backup exported to exports/${dbName}.${engine.type === 'mssql' ? 'bak' : 'sql'}`,
        );
      }

      return {
        engine: `${engine.type} ${engine.version}`,
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      // Capture detailed error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      if (errorStack) {
        console.error(`\n[ERROR DETAILS] ${errorMessage}`);
        console.error(errorStack);
      }

      return {
        engine: `${engine.type} ${engine.version}`,
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    } finally {
      if (containerId) {
        console.log('Stopping container...');
        await this.containerManager.stopContainer(containerId);
      }
    }
  }

  private getRunner(target: string, ormPath?: string): MigrationRunner {
    if (target.toLowerCase() === 'sequelize') return new SequelizeRunner(ormPath);
    if (target.toLowerCase() === 'typeorm') return new TypeORMRunner(ormPath);
    throw new Error(`Unsupported test target: ${target}`);
  }

  private async waitForDb(config: DatabaseConfig, maxRetries = 30): Promise<void> {
    console.log('Waiting for database to be ready...');
    for (let i = 0; i < maxRetries; i++) {
      try {
        const connector = ConnectionFactory.create(config);
        await connector.connect();
        await connector.disconnect();
        console.log('Database is ready.');
        return;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 2000)); // Wait 2s
      }
    }
    throw new Error('Database failed to start within timeout');
  }

  private printReport(results: TestResult[]) {
    console.log('\n--- Migration Test Report ---');
    console.table(
      results.map((r) => ({
        Engine: r.engine,
        Result: r.success ? 'SUCCESS' : 'FAILED',
        Duration: `${(r.durationMs / 1000).toFixed(2)}s`,
        Error: r.error || '-',
      })),
    );

    const failed = results.some((r) => !r.success);
    if (failed) {
      console.error('\nSome tests failed.');
      // Don't exit process here, let CLI handle it
    } else {
      console.log('\nAll tests passed!');
    }
  }
}

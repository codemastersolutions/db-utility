import { join } from 'node:path';
import { existsSync, readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { ContainerManager } from './ContainerManager';
import { MigrationRunner } from './runners/MigrationRunner';
import { SequelizeRunner } from './runners/SequelizeRunner';
import { TypeORMRunner } from './runners/TypeORMRunner';
import { DatabaseType, DatabaseConfig } from '../types/database';
import { ConnectionFactory } from '../database/ConnectionFactory';
import { PackageManager, InstallScope } from '../utils/PackageManager';
import { MigrationTestDatabaseConfig } from '../config/AppConfig';

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

interface TestEngineConfig {
  type: DatabaseType;
  version: string;
  originalString?: string;
  databaseName?: string;
}

interface ResolvedTestDatabaseImage {
  image: string;
  versionLabel: string;
}

export class MigrationTester {
  private readonly containerManager: ContainerManager;
  private readonly packageManager: PackageManager;

  constructor(containerManager?: ContainerManager) {
    this.containerManager = containerManager || new ContainerManager();
    this.packageManager = new PackageManager();
  }

  async test(
    target: string,
    migrationsDir: string,
    engines?: string[],
    backup?: boolean,
    testDatabase?: MigrationTestDatabaseConfig,
  ): Promise<void> {
    const hasDocker = await this.containerManager.checkDocker();
    if (!hasDocker) {
      console.error('Docker not found. Skipping migration tests.');
      return;
    }

    // Determine engines to test
    let testEngines: TestEngineConfig[] = [];

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

    const effectiveTestDatabase = engines && engines.length > 0 ? undefined : testDatabase;

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
        const result = await this.runTest(
          target,
          migrationsDir,
          engine,
          ormPath,
          backup,
          effectiveTestDatabase,
        );
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
    const cwd = process.cwd();
    const pkgPath = join(cwd, 'package.json');
    let hasPackageJson = false;
    let hasOrmInPackageJson = false;

    if (existsSync(pkgPath)) {
      hasPackageJson = true;
      try {
        const pkgRaw = readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        const deps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
          ...pkg.peerDependencies,
        };
        hasOrmInPackageJson = !!deps[target];
      } catch (e) {
        console.warn(
          `Failed to read or parse package.json: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    const isInstalledLocal = await this.packageManager.isInstalled(target, 'local');
    const isInstalledGlobal = await this.packageManager.isInstalled(target, 'global');

    if (hasPackageJson && hasOrmInPackageJson && isInstalledLocal) {
      return {
        versions: ['current'],
        shouldInstall: false,
        scope: 'dependencies',
        shouldUninstall: false,
      };
    }

    if (!hasPackageJson && (isInstalledLocal || isInstalledGlobal)) {
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
    const match = new RegExp(/(\d+(\.\d+)?)/).exec(versionString);
    return match ? match[1] : 'latest';
  }

  private isVersionOnlyTestDatabase(
    value: MigrationTestDatabaseConfig | undefined,
  ): value is string {
    return typeof value === 'string' && /^\d+(?:\.\d+)*$/.test(value.trim());
  }

  private parseImageReference(image: string): {
    repository: string;
    tag: string;
    registryHost?: string;
  } {
    const trimmed = image.trim();
    const lastColonIndex = trimmed.lastIndexOf(':');
    const lastSlashIndex = trimmed.lastIndexOf('/');

    const hasTag = lastColonIndex > lastSlashIndex;
    const repository = hasTag ? trimmed.slice(0, lastColonIndex) : trimmed;
    const tag = hasTag ? trimmed.slice(lastColonIndex + 1) : 'latest';
    const firstSegment = repository.split('/')[0];
    const hasRegistryHost =
      firstSegment.includes('.') || firstSegment.includes(':') || firstSegment === 'localhost';

    return {
      repository,
      tag,
      ...(hasRegistryHost ? { registryHost: firstSegment } : {}),
    };
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

  private getDefaultImageRepository(type: DatabaseType): string {
    if (type === 'postgres') return 'docker.io/library/postgres';
    if (type === 'mysql') return 'docker.io/library/mysql';
    if (type === 'mssql') return 'mcr.microsoft.com/mssql/server';
    return 'docker.io/library/postgres';
  }

  private getDockerHubImageReference(image: string): string {
    const { repository, tag } = this.parseImageReference(image);
    const normalizedRepository =
      repository.includes('/') || repository.startsWith('docker.io/')
        ? repository
        : `library/${repository}`;
    const repositoryWithoutDockerHubPrefix = normalizedRepository.replace(/^docker\.io\//, '');
    return `docker.io/${repositoryWithoutDockerHubPrefix}:${tag}`;
  }

  private async fetchDockerHubTags(repository: string): Promise<string[]> {
    const normalizedRepository = repository.replace(/^docker\.io\//, '');
    const [namespace, ...repositoryParts] = normalizedRepository.includes('/')
      ? normalizedRepository.split('/')
      : ['library', normalizedRepository];
    const repositoryName = repositoryParts.join('/');

    if (!repositoryName) {
      return [];
    }

    const tags: string[] = [];
    let nextUrl = `https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repositoryName}/tags?page_size=100`;

    while (nextUrl) {
      const response = await fetch(nextUrl);
      if (!response.ok) {
        throw new Error(`Docker Hub tag lookup failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        results?: Array<{ name?: string }>;
        next?: string | null;
      };

      for (const tag of payload.results ?? []) {
        if (typeof tag.name === 'string' && tag.name.length > 0) {
          tags.push(tag.name);
        }
      }

      nextUrl = payload.next ?? '';
    }

    return tags;
  }

  private async fetchRegistryTags(imageRepository: string): Promise<string[]> {
    const { repository, registryHost } = this.parseImageReference(imageRepository);

    if (!registryHost || registryHost === 'docker.io') {
      return this.fetchDockerHubTags(imageRepository);
    }

    const repositoryPath = repository.replace(`${registryHost}/`, '');
    const response = await fetch(`https://${registryHost}/v2/${repositoryPath}/tags/list?n=1000`);
    if (!response.ok) {
      throw new Error(`Registry tag lookup failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { tags?: string[] };
    return payload.tags ?? [];
  }

  private getTagVersionParts(tag: string): number[] | undefined {
    const match = /^(\d+(?:\.\d+)*)/.exec(tag);
    if (!match) {
      return undefined;
    }

    return match[1].split('.').map((part) => Number.parseInt(part, 10));
  }

  private compareVersionParts(left: number[], right: number[]): number {
    const maxLength = Math.max(left.length, right.length);

    for (let index = 0; index < maxLength; index++) {
      const leftPart = left[index] ?? -1;
      const rightPart = right[index] ?? -1;

      if (leftPart !== rightPart) {
        return rightPart - leftPart;
      }
    }

    return 0;
  }

  private getTagPriority(tag: string): number {
    if (/^\d+(?:\.\d+)*$/.test(tag)) {
      return 0;
    }

    if (/^\d+(?:\.\d+)*-latest$/.test(tag)) {
      return 1;
    }

    if (/^\d+(?:\.\d+)*-[A-Za-z0-9._-]+$/.test(tag)) {
      return 2;
    }

    return 3;
  }

  private resolveLatestTag(tags: string[], requestedVersion: string): string | undefined {
    const requestedParts = requestedVersion.split('.').map((part) => Number.parseInt(part, 10));

    for (let length = requestedParts.length; length >= 1; length--) {
      const prefix = requestedParts.slice(0, length);
      const matches = tags
        .reduce<Array<{ tag: string; versionParts: number[] }>>((accumulator, tag) => {
          const versionParts = this.getTagVersionParts(tag);
          if (!Array.isArray(versionParts)) {
            return accumulator;
          }

          if (prefix.every((part, index) => versionParts[index] === part)) {
            accumulator.push({ tag, versionParts });
          }

          return accumulator;
        }, [])
        .sort((left, right) => {
          const versionComparison = this.compareVersionParts(left.versionParts, right.versionParts);
          if (versionComparison !== 0) {
            return versionComparison;
          }

          const priorityComparison = this.getTagPriority(left.tag) - this.getTagPriority(right.tag);
          if (priorityComparison !== 0) {
            return priorityComparison;
          }

          return left.tag.length - right.tag.length || left.tag.localeCompare(right.tag);
        });

      if (matches.length > 0) {
        return matches[0].tag;
      }
    }

    return undefined;
  }

  private async resolveVersionBasedImage(
    type: DatabaseType,
    requestedVersion: string,
  ): Promise<ResolvedTestDatabaseImage> {
    const repository = this.getDefaultImageRepository(type);

    try {
      const tags = await this.fetchRegistryTags(repository);
      const resolvedTag = this.resolveLatestTag(tags, requestedVersion);

      if (resolvedTag) {
        return {
          image: `${repository}:${resolvedTag}`,
          versionLabel: resolvedTag,
        };
      }
    } catch {
      // Falls back to direct image probing below when the registry tag listing is unavailable.
    }

    const directCandidates =
      type === 'mssql' ? [`${requestedVersion}-latest`, requestedVersion] : [requestedVersion];

    for (const candidate of directCandidates) {
      const image = `${repository}:${candidate}`;
      if (await this.containerManager.imageExists(image)) {
        return {
          image,
          versionLabel: candidate,
        };
      }
    }

    throw new Error(
      `No Docker image found for ${type} with requested version "${requestedVersion}".`,
    );
  }

  private async resolveConfiguredImage(
    override: Exclude<MigrationTestDatabaseConfig, undefined>,
  ): Promise<ResolvedTestDatabaseImage> {
    if (typeof override === 'string') {
      const image = this.getDockerHubImageReference(override);
      if (!(await this.containerManager.imageExists(image))) {
        throw new Error(`No Docker image found for "${override}".`);
      }

      return {
        image,
        versionLabel: this.parseImageReference(image).tag,
      };
    }

    if (override.registry) {
      const image = `${override.registry.replace(/\/$/, '')}/${override.image}`;
      if (!(await this.containerManager.imageExists(image))) {
        throw new Error(`No Docker image found for "${image}".`);
      }

      return {
        image,
        versionLabel: this.parseImageReference(image).tag,
      };
    }

    if (await this.containerManager.imageExists(override.image)) {
      return {
        image: override.image,
        versionLabel: this.parseImageReference(override.image).tag,
      };
    }

    const dockerHubImage = this.getDockerHubImageReference(override.image);
    if (await this.containerManager.imageExists(dockerHubImage)) {
      return {
        image: dockerHubImage,
        versionLabel: this.parseImageReference(dockerHubImage).tag,
      };
    }

    throw new Error(`No Docker image found for "${override.image}".`);
  }

  private async resolveTestDatabaseImage(
    engine: TestEngineConfig,
    testDatabase?: MigrationTestDatabaseConfig,
  ): Promise<ResolvedTestDatabaseImage> {
    if (!testDatabase) {
      return {
        image: this.getImageName(engine.type, engine.version),
        versionLabel: engine.version,
      };
    }

    if (this.isVersionOnlyTestDatabase(testDatabase)) {
      return this.resolveVersionBasedImage(engine.type, testDatabase.trim());
    }

    return this.resolveConfiguredImage(testDatabase);
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

  private async ensureDialectDependencies(target: string, type: DatabaseType): Promise<void> {
    const normalizedTarget = target.toLowerCase();

    if (normalizedTarget === 'sequelize' && type === 'mssql') {
      const isSequelizeGlobal = await this.packageManager.isInstalled('sequelize', 'global');
      const scope: InstallScope = isSequelizeGlobal ? 'global' : 'devDependencies';
      const isTediousInstalled = await this.packageManager.isInstalled(
        'tedious',
        isSequelizeGlobal ? 'global' : 'local',
      );

      if (!isTediousInstalled) {
        await this.packageManager.install('tedious', { scope });
      }
    }
  }

  private async runTest(
    target: string,
    migrationsDir: string,
    engine: TestEngineConfig,
    ormPath?: string,
    backup?: boolean,
    testDatabase?: MigrationTestDatabaseConfig,
  ): Promise<TestResult> {
    const startTime = Date.now();
    const password = randomBytes(18).toString('base64url');
    const port = Math.floor(Math.random() * (60000 - 10000) + 10000); // Random port
    let image = this.getImageName(engine.type, engine.version);
    let versionLabel = engine.version;
    const dbName = engine.databaseName || 'testdb';
    const backupFileName = `${dbName}.${engine.type === 'mssql' ? 'bak' : 'sql'}`;

    let containerId: string | null = null;

    try {
      const resolvedTestDatabase = await this.resolveTestDatabaseImage(engine, testDatabase);
      image = resolvedTestDatabase.image;
      versionLabel = resolvedTestDatabase.versionLabel;

      await this.ensureDialectDependencies(target, engine.type);

      console.log(`Starting container ${image} on port ${port}...`);
      console.log('Backup flag:', backup);

      if (backup) {
        const friendlyName = this.getFriendlyName(engine.type, versionLabel);
        const backupDir = join(process.cwd(), 'exports', 'backups', friendlyName);

        if (!existsSync(backupDir)) {
          mkdirSync(backupDir, { recursive: true });
        }
      }

      containerId = await this.containerManager.startContainer(
        image,
        this.getEnv(engine.type, password, dbName),
        port,
        engine.type === 'mssql' ? 1433 : engine.type === 'mysql' ? 3306 : 5432,
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
        const friendlyName = this.getFriendlyName(engine.type, versionLabel);
        const backupDir = join(process.cwd(), 'exports', 'backups', friendlyName);
        const backupFile = join(backupDir, backupFileName);

        try {
          if (existsSync(backupFile)) {
            unlinkSync(backupFile);
          }
        } catch (e) {
          console.warn(
            `Failed to remove previous backup ${backupFile}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }

        if (engine.type === 'mssql') {
          const containerBackupPath = `/var/opt/mssql/backup/${backupFileName}`;

          await this.containerManager.execInContainer(
            containerId,
            'mkdir -p /var/opt/mssql/backup',
          );

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
            `${sqlCmdPath} -S localhost -U sa${extraArgs} -Q "BACKUP DATABASE [${dbName}] TO DISK = '${containerBackupPath}'"`,
            { SQLCMDPASSWORD: password },
          );

          await this.containerManager.copyFromContainer(
            containerId,
            containerBackupPath,
            backupFile,
          );
        } else if (engine.type === 'mysql') {
          const containerBackupPath = `/tmp/${backupFileName}`;

          await this.containerManager.execInContainer(
            containerId,
            `sh -c "mysqldump -u root -p'${password}' ${dbName} > ${containerBackupPath}"`,
          );

          await this.containerManager.copyFromContainer(
            containerId,
            containerBackupPath,
            backupFile,
          );
        } else if (engine.type === 'postgres') {
          const containerBackupPath = `/tmp/${backupFileName}`;

          await this.containerManager.execInContainer(
            containerId,
            `sh -c "pg_dump -U postgres ${dbName} > ${containerBackupPath}"`,
            { PGPASSWORD: password },
          );

          await this.containerManager.copyFromContainer(
            containerId,
            containerBackupPath,
            backupFile,
          );
        }
        console.log(
          `Backup exported to ${join('exports', 'backups', friendlyName, backupFileName)}`,
        );
      }

      return {
        engine: `${engine.type} ${versionLabel}`,
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
        engine: `${engine.type} ${versionLabel}`,
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
      } catch {
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

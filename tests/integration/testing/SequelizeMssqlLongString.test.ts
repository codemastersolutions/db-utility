import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { ConnectionFactory } from '../../../src/database/ConnectionFactory';
import { DatabaseConfig } from '../../../src/types/database';
import { DatabaseSchema } from '../../../src/types/introspection';
import { ContainerManager } from '../../../src/testing/ContainerManager';
import { SequelizeRunner } from '../../../src/testing/runners/SequelizeRunner';

const runIntegration = process.env.DBUTILITY_RUN_DOCKER_INTEGRATION === '1';
const maybeIt = runIntegration ? it : it.skip;
const localRequire = createRequire(import.meta.url);

describe('Sequelize MSSQL Long String Integration', () => {
  maybeIt(
    'should run the generated migration and insert a 5000-char value without MSSQL size errors',
    async () => {
      const containerManager = new ContainerManager();
      const hasDocker = await containerManager.checkDocker();

      expect(hasDocker).toBe(true);

      const schema: DatabaseSchema = {
        tables: [
          {
            name: 'LongTextSample',
            columns: [
              {
                name: 'ID',
                dataType: 'int',
                isNullable: false,
                hasDefault: false,
                isPrimaryKey: false,
                isUnique: false,
                isAutoIncrement: false,
              },
              {
                name: 'VALORSTR',
                dataType: 'varchar',
                maxLength: 8000,
                isNullable: true,
                hasDefault: false,
                isPrimaryKey: false,
                isUnique: false,
                isAutoIncrement: false,
              },
            ],
            indexes: [
              {
                name: 'PK_LongTextSample',
                columns: ['ID'],
                isUnique: true,
                isPrimary: true,
              },
            ],
            foreignKeys: [],
          },
        ],
      };

      const generator = new SequelizeGenerator();
      const [migration] = await generator.generateMigrations(schema);

      expect(migration.content).toContain('type: Sequelize.TEXT');

      const migrationsDir = mkdtempSync(join(tmpdir(), 'dbutility-mssql-long-string-'));
      writeFileSync(join(migrationsDir, migration.fileName), migration.content, 'utf8');

      const dbName = `test_${randomBytes(4).toString('hex')}`;
      const port = 14000 + Math.floor(Math.random() * 10000);
      const password = 'DbUtility1!';
      const masterConfig: DatabaseConfig = {
        type: 'mssql',
        host: 'localhost',
        port,
        username: 'sa',
        password,
        database: 'master',
        ssl: false,
        connectTimeoutMs: 15000,
      };

      let containerId: string | null = null;

      try {
        containerId = await containerManager.startContainer(
          'mcr.microsoft.com/mssql/server:2022-latest',
          { ACCEPT_EULA: 'Y', MSSQL_SA_PASSWORD: password },
          port,
          1433,
        );

        await waitForDatabase(masterConfig);

        const masterConnector = ConnectionFactory.create(masterConfig);
        await masterConnector.connect();
        await masterConnector.query(`CREATE DATABASE [${dbName}]`, [], { bypassSafety: true });
        await masterConnector.disconnect();

        const runner = new SequelizeRunner(resolveSequelizePath());
        await runner.run(migrationsDir, { ...masterConfig, database: dbName });

        const connector = ConnectionFactory.create({ ...masterConfig, database: dbName });
        await connector.connect();

        const longValue = 'a'.repeat(5000);
        await connector.query(
          'INSERT INTO [LongTextSample] ([ID], [VALORSTR]) VALUES (@param0, @param1)',
          [1, longValue],
          { bypassSafety: true },
        );

        const rows = await connector.query<{ length: number | string }>(
          'SELECT LEN([VALORSTR]) as length FROM [LongTextSample] WHERE [ID] = @param0',
          [1],
          { bypassSafety: true },
        );

        expect(Number(rows[0]?.length)).toBe(5000);

        await connector.disconnect();
      } finally {
        if (containerId) {
          await containerManager.stopContainer(containerId);
        }

        rmSync(migrationsDir, { recursive: true, force: true });
      }
    },
    180000,
  );
});

async function waitForDatabase(config: DatabaseConfig, maxRetries = 45): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const connector = ConnectionFactory.create(config);

    try {
      await connector.connect();
      await connector.disconnect();
      return;
    } catch {
      await safeDisconnect(connector);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error('MSSQL container failed to become ready within timeout');
}

async function safeDisconnect(connector: ReturnType<typeof ConnectionFactory.create>): Promise<void> {
  try {
    await connector.disconnect();
  } catch {
    // Ignore cleanup failures while polling for readiness.
  }
}

function resolveSequelizePath(): string {
  try {
    return localRequire.resolve('sequelize');
  } catch {
    throw new Error(
      'Sequelize not found in the current workspace. Install sequelize locally to run this integration test.',
    );
  }
}

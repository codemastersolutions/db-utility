import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConnectionFactory } from '../../../src/database/ConnectionFactory';
import { TypeORMGenerator } from '../../../src/generators/TypeORMGenerator';
import { ContainerManager } from '../../../src/testing/ContainerManager';
import { TypeORMRunner } from '../../../src/testing/runners/TypeORMRunner';
import { DatabaseConfig } from '../../../src/types/database';
import { DatabaseSchema } from '../../../src/types/introspection';

const runIntegration = process.env.DBUTILITY_RUN_DOCKER_INTEGRATION === '1';
const maybeIt = runIntegration ? it : it.skip;
const localRequire = createRequire(import.meta.url);

describe('TypeORM MSSQL Date Default Integration', () => {
  maybeIt(
    'should run the generated migration without applying invalid numeric defaults to datetimeoffset columns',
    async () => {
      const containerManager = new ContainerManager();
      const hasDocker = await containerManager.checkDocker();

      expect(hasDocker).toBe(true);

      const schema: DatabaseSchema = {
        tables: [
          {
            name: 'DateDefaultSampleTypeorm',
            columns: [
              {
                name: 'ID',
                dataType: 'int',
                isNullable: false,
                hasDefault: false,
                isPrimaryKey: true,
                isUnique: false,
                isAutoIncrement: false,
              },
              {
                name: 'DATAFECHAMENTOFACTOR',
                dataType: 'datetimeoffset',
                isNullable: true,
                hasDefault: true,
                defaultValue: '((0))',
                isPrimaryKey: false,
                isUnique: false,
                isAutoIncrement: false,
              },
            ],
            indexes: [
              {
                name: 'PK_DateDefaultSampleTypeorm',
                columns: ['ID'],
                isUnique: true,
                isPrimary: true,
              },
            ],
            foreignKeys: [],
          },
        ],
      };

      const generator = new TypeORMGenerator();
      const [migration] = await generator.generateMigrations(schema);

      expect(migration.content).toContain("type: 'datetimeoffset'");
      expect(migration.content).not.toContain('default: 0');

      const migrationsDir = mkdtempSync(join(process.cwd(), '.tmp-dbutility-mssql-date-default-'));
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

        const runner = new TypeORMRunner(resolveTypeOrmPath());
        await runner.run(migrationsDir, { ...masterConfig, database: dbName });

        const connector = ConnectionFactory.create({ ...masterConfig, database: dbName });
        await connector.connect();

        await connector.query(
          'INSERT INTO [DateDefaultSampleTypeorm] ([ID]) VALUES (@param0)',
          [1],
          { bypassSafety: true },
        );

        const rows = await connector.query<{ definition: string | null }>(
          `
            SELECT dc.definition AS definition
            FROM sys.columns c
            INNER JOIN sys.tables t
              ON c.object_id = t.object_id
            LEFT JOIN sys.default_constraints dc
              ON c.default_object_id = dc.object_id
            WHERE t.name = 'DateDefaultSampleTypeorm'
              AND c.name = 'DATAFECHAMENTOFACTOR'
          `,
          [],
          { bypassSafety: true },
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]?.definition ?? null).toBeNull();

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

function resolveTypeOrmPath(): string {
  try {
    return localRequire.resolve('typeorm');
  } catch {
    throw new Error(
      'TypeORM not found in the current workspace. Install typeorm locally to run this integration test.',
    );
  }
}

import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConnectionFactory } from '../../../src/database/ConnectionFactory';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { ContainerManager } from '../../../src/testing/ContainerManager';
import { SequelizeRunner } from '../../../src/testing/runners/SequelizeRunner';
import { DatabaseConfig } from '../../../src/types/database';
import { DatabaseSchema } from '../../../src/types/introspection';

const runIntegration = process.env.DBUTILITY_RUN_DOCKER_INTEGRATION === '1';
const maybeIt = runIntegration ? it : it.skip;
const localRequire = createRequire(import.meta.url);

describe('Sequelize MSSQL Composite Foreign Key SET NULL Integration', () => {
  maybeIt(
    'should apply ON DELETE SET NULL to both columns of a composite foreign key',
    async () => {
      const containerManager = new ContainerManager();
      const hasDocker = await containerManager.checkDocker();

      expect(hasDocker).toBe(true);

      const schema: DatabaseSchema = {
        tables: [
          {
            name: 'FCFO',
            columns: [
              {
                name: 'CODCOLIGADA',
                dataType: 'smallint',
                isNullable: false,
                hasDefault: false,
                isPrimaryKey: false,
                isUnique: false,
                isAutoIncrement: false,
              },
              {
                name: 'CODCFO',
                dataType: 'varchar',
                maxLength: 25,
                isNullable: false,
                hasDefault: false,
                isPrimaryKey: false,
                isUnique: false,
                isAutoIncrement: false,
              },
            ],
            indexes: [
              {
                name: 'PKFCFO',
                columns: ['CODCOLIGADA', 'CODCFO'],
                isUnique: true,
                isPrimary: true,
              },
            ],
            foreignKeys: [],
          },
          {
            name: 'XXCONTRATO',
            columns: [
              {
                name: 'CODCOLIGADA',
                dataType: 'smallint',
                isNullable: false,
                hasDefault: false,
                isPrimaryKey: false,
                isUnique: false,
                isAutoIncrement: false,
              },
              {
                name: 'NUMCONTRATO',
                dataType: 'int',
                isNullable: false,
                hasDefault: false,
                isPrimaryKey: false,
                isUnique: false,
                isAutoIncrement: false,
              },
              {
                name: 'CODCOLIGADACONTRATADA',
                dataType: 'smallint',
                isNullable: true,
                hasDefault: false,
                isPrimaryKey: false,
                isUnique: false,
                isAutoIncrement: false,
              },
              {
                name: 'CODCONTRATADA',
                dataType: 'varchar',
                maxLength: 25,
                isNullable: true,
                hasDefault: false,
                isPrimaryKey: false,
                isUnique: false,
                isAutoIncrement: false,
              },
            ],
            indexes: [
              {
                name: 'PKXXCONTRATO',
                columns: ['CODCOLIGADA', 'NUMCONTRATO'],
                isUnique: true,
                isPrimary: true,
              },
            ],
            foreignKeys: [
              {
                name: 'FKXXCONTRATO_FCFO_SETNULL',
                tableName: 'XXCONTRATO',
                columns: ['CODCOLIGADACONTRATADA', 'CODCONTRATADA'],
                referencedTable: 'FCFO',
                referencedColumns: ['CODCOLIGADA', 'CODCFO'],
                deleteRule: 'SET NULL',
                updateRule: 'NO ACTION',
              },
            ],
          },
        ],
      };

      const generator = new SequelizeGenerator();
      const migrations = await generator.generateMigrations(schema);
      const fkMigration = migrations.find((migration) => migration.fileName.includes('add-fks'));

      expect(fkMigration?.content).toContain("fields: ['CODCOLIGADA','CODCFO']");
      expect(fkMigration?.content).toContain("onDelete: 'set null'");

      const migrationsDir = mkdtempSync(join(tmpdir(), 'dbutility-mssql-composite-fk-set-null-'));
      for (const migration of migrations) {
        writeFileSync(join(migrationsDir, migration.fileName), migration.content, 'utf8');
      }

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

        const referentialActionRows = await connector.query<{ delete_action: string }>(
          `
            SELECT delete_referential_action_desc AS delete_action
            FROM sys.foreign_keys
            WHERE name = 'FKXXCONTRATO_FCFO_SETNULL'
          `,
          [],
          { bypassSafety: true },
        );

        expect(referentialActionRows[0]?.delete_action).toBe('SET_NULL');

        await connector.query(
          'INSERT INTO [FCFO] ([CODCOLIGADA], [CODCFO]) VALUES (@param0, @param1)',
          [1, 'FORN-001'],
          { bypassSafety: true },
        );

        await connector.query(
          'INSERT INTO [XXCONTRATO] ([CODCOLIGADA], [NUMCONTRATO], [CODCOLIGADACONTRATADA], [CODCONTRATADA]) VALUES (@param0, @param1, @param2, @param3)',
          [1, 100, 1, 'FORN-001'],
          { bypassSafety: true },
        );

        await connector.query(
          'DELETE FROM [FCFO] WHERE [CODCOLIGADA] = @param0 AND [CODCFO] = @param1',
          [1, 'FORN-001'],
          { bypassSafety: true },
        );

        const rows = await connector.query<{
          coligada: number | null;
          contratada: string | null;
        }>(
          `
            SELECT
              [CODCOLIGADACONTRATADA] AS coligada,
              [CODCONTRATADA] AS contratada
            FROM [XXCONTRATO]
            WHERE [CODCOLIGADA] = @param0
              AND [NUMCONTRATO] = @param1
          `,
          [1, 100],
          { bypassSafety: true },
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]?.coligada ?? null).toBeNull();
        expect(rows[0]?.contratada ?? null).toBeNull();

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

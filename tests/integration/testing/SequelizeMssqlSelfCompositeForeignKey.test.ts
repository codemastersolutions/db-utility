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

describe('Sequelize MSSQL Self Composite Foreign Key Integration', () => {
  maybeIt(
    'should create and enforce a self-referencing composite foreign key',
    async () => {
      const containerManager = new ContainerManager();
      const hasDocker = await containerManager.checkDocker();

      expect(hasDocker).toBe(true);

      const schema: DatabaseSchema = {
        tables: [
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
                name: 'CODCOLIGADAMODELOCONTRATO',
                dataType: 'smallint',
                isNullable: true,
                hasDefault: false,
                isPrimaryKey: false,
                isUnique: false,
                isAutoIncrement: false,
              },
              {
                name: 'NUMMODELOCONTRATO',
                dataType: 'int',
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
                name: 'FKXXCONTRATO_XXCONTRATO',
                tableName: 'XXCONTRATO',
                columns: ['CODCOLIGADAMODELOCONTRATO', 'NUMMODELOCONTRATO'],
                referencedTable: 'XXCONTRATO',
                referencedColumns: ['CODCOLIGADA', 'NUMCONTRATO'],
                deleteRule: 'NO ACTION',
                updateRule: 'NO ACTION',
              },
            ],
          },
        ],
      };

      const generator = new SequelizeGenerator();
      const migrations = await generator.generateMigrations(schema);
      const fkMigration = migrations.find((migration) => migration.fileName.includes('add-fks'));

      expect(fkMigration?.content).toContain("table: 'XXCONTRATO'");
      expect(fkMigration?.content).toContain("fields: ['CODCOLIGADA','NUMCONTRATO']");

      const migrationsDir = mkdtempSync(join(tmpdir(), 'dbutility-mssql-self-composite-fk-'));
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

        const fkRows = await connector.query<{
          column_name: string;
          referenced_column_name: string;
        }>(
          `
            SELECT
              cp.name AS column_name,
              cr.name AS referenced_column_name
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc
              ON fk.object_id = fkc.constraint_object_id
            INNER JOIN sys.tables tp
              ON fkc.parent_object_id = tp.object_id
            INNER JOIN sys.columns cp
              ON fkc.parent_object_id = cp.object_id
             AND fkc.parent_column_id = cp.column_id
            INNER JOIN sys.columns cr
              ON fkc.referenced_object_id = cr.object_id
             AND fkc.referenced_column_id = cr.column_id
            WHERE tp.name = 'XXCONTRATO'
              AND fk.name = 'FKXXCONTRATO_XXCONTRATO'
            ORDER BY fkc.constraint_column_id
          `,
          [],
          { bypassSafety: true },
        );

        expect(fkRows).toHaveLength(2);
        expect(fkRows.map((row) => row.column_name)).toEqual([
          'CODCOLIGADAMODELOCONTRATO',
          'NUMMODELOCONTRATO',
        ]);
        expect(fkRows.map((row) => row.referenced_column_name)).toEqual([
          'CODCOLIGADA',
          'NUMCONTRATO',
        ]);

        await connector.query(
          'INSERT INTO [XXCONTRATO] ([CODCOLIGADA], [NUMCONTRATO]) VALUES (@param0, @param1)',
          [1, 10],
          { bypassSafety: true },
        );

        await connector.query(
          'INSERT INTO [XXCONTRATO] ([CODCOLIGADA], [NUMCONTRATO], [CODCOLIGADAMODELOCONTRATO], [NUMMODELOCONTRATO]) VALUES (@param0, @param1, @param2, @param3)',
          [1, 11, 1, 10],
          { bypassSafety: true },
        );

        await expect(
          connector.query(
            'INSERT INTO [XXCONTRATO] ([CODCOLIGADA], [NUMCONTRATO], [CODCOLIGADAMODELOCONTRATO], [NUMMODELOCONTRATO]) VALUES (@param0, @param1, @param2, @param3)',
            [1, 12, 9, 99],
            { bypassSafety: true },
          ),
        ).rejects.toThrow();

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

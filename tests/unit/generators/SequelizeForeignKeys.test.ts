import { describe, expect, it } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { DatabaseSchema } from '../../../src/types/introspection';

describe('Sequelize Foreign Keys', () => {
  it('should generate composite foreign keys with matching referenced columns', async () => {
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
              isPrimaryKey: true,
              isUnique: false,
              isAutoIncrement: false,
            },
            {
              name: 'NUMCONTRATO',
              dataType: 'int',
              isNullable: false,
              hasDefault: false,
              isPrimaryKey: true,
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
              isPrimary: true,
              isUnique: true,
            },
          ],
          foreignKeys: [
            {
              name: 'FKXXCONTRATO_FCFO',
              tableName: 'XXCONTRATO',
              columns: ['CODCOLIGADACONTRATADA', 'CODCONTRATADA'],
              referencedTable: 'FCFO',
              referencedColumns: ['CODCOLIGADA', 'CODCFO'],
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

    expect(fkMigration?.content).toContain("fields: ['CODCOLIGADACONTRATADA','CODCONTRATADA']");
    expect(fkMigration?.content).toContain("table: 'FCFO'");
    expect(fkMigration?.content).toContain("fields: ['CODCOLIGADA','CODCFO']");
    expect(fkMigration?.content).not.toContain("field: 'CODCOLIGADA'");
  });

  it('should keep singular referenced field syntax for simple foreign keys', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'XXCONTRATO',
          columns: [
            {
              name: 'CODCONTRATOSTATUS',
              dataType: 'int',
              isNullable: false,
              hasDefault: false,
              isPrimaryKey: false,
              isUnique: false,
              isAutoIncrement: false,
            },
          ],
          indexes: [],
          foreignKeys: [
            {
              name: 'FKXXCONTRATO_XXCONTRATOSTATUS',
              tableName: 'XXCONTRATO',
              columns: ['CODCONTRATOSTATUS'],
              referencedTable: 'XXCONTRATOSTATUS',
              referencedColumns: ['CODCONTRATOSTATUS'],
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

    expect(fkMigration?.content).toContain("field: 'CODCONTRATOSTATUS'");
    expect(fkMigration?.content).not.toContain("fields: ['CODCONTRATOSTATUS']");
  });
});

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
    expect(fkMigration?.content).not.toContain(
      "references: {\n          table: 'XXCONTRATOSTATUS',\n          fields:",
    );
  });

  it('should generate per-foreign-key error handling with detailed failure messages', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'VLNTPESSOASCOMP',
          columns: [
            {
              name: 'CODPESSOA',
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
              name: 'FKVLNTPESSOASCOMP_PPESSOAS',
              tableName: 'VLNTPESSOASCOMP',
              columns: ['CODPESSOA'],
              referencedTable: 'PPESSOA',
              referencedColumns: ['CODIGO'],
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

    expect(fkMigration?.content).toContain('function getForeignKeyErrorMessage(error)');
    expect(fkMigration?.content).toContain("console.warn('Failed to create FK FKVLNTPESSOASCOMP_PPESSOAS on table VLNTPESSOASCOMP:'");
    expect(fkMigration?.content).toContain(
      "throw new Error('Foreign key creation failed for table VLNTPESSOASCOMP: ' + failures.join(' | '));",
    );
    expect(fkMigration?.content).toContain(
      "failures.push('FK FKVLNTPESSOASCOMP_PPESSOAS: ' + reason);",
    );
  });

  it('should skip foreign key migrations when disableForeignKeys is enabled', async () => {
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
    const migrations = await generator.generateMigrations(schema, undefined, {
      disableForeignKeys: true,
    });

    expect(migrations.some((migration) => migration.fileName.includes('add-fks'))).toBe(false);
  });
});

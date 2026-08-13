import { describe, expect, it } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { TypeORMGenerator } from '../../../src/generators/TypeORMGenerator';
import { DatabaseSchema } from '../../../src/types/introspection';

const schema: DatabaseSchema = {
  tables: [
    {
      name: 'Users',
      schemaName: 'audit',
      columns: [
        {
          name: 'id',
          dataType: 'int',
          isPrimaryKey: true,
          isAutoIncrement: true,
          isNullable: false,
          hasDefault: false,
          isUnique: true,
        },
      ],
      indexes: [{ name: 'PK_Users', columns: ['id'], isPrimary: true, isUnique: true }],
      foreignKeys: [],
    },
  ],
};

describe('Generated migration existing table guards', () => {
  it('should guard Sequelize create-table migrations when the table already exists', async () => {
    const generator = new SequelizeGenerator();
    const migrations = await generator.generateMigrations(schema);
    const migration = migrations.find((file) => file.fileName.includes('create-audit_Users'));

    expect(migration).toBeDefined();
    expect(migration?.content).toContain("if (typeof queryInterface.tableExists === 'function') {");
    expect(migration?.content).toContain(
      "tableExists = await queryInterface.tableExists({ tableName: 'Users', schema: 'audit' });",
    );
    expect(migration?.content).toContain(
      "await queryInterface.describeTable({ tableName: 'Users', schema: 'audit' });",
    );
    expect(migration?.content).toContain("errorMessage.includes('no description found for')");
    expect(migration?.content).toContain(
      'console.log("Skipping table creation for \\"audit.Users\\" because it already exists.");',
    );
    expect(migration?.content).toContain(
      "await queryInterface.createTable({ tableName: 'Users', schema: 'audit' }, {",
    );
  });

  it('should guard TypeORM create-table migrations when the table already exists', async () => {
    const generator = new TypeORMGenerator();
    const migrations = await generator.generateMigrations(schema);
    const migration = migrations.find((file) => file.fileName.includes('CreateAudit_Users'));

    expect(migration).toBeDefined();
    expect(migration?.content).toContain(
      'const tableExists = await queryRunner.hasTable("audit.Users");',
    );
    expect(migration?.content).toContain(
      'console.log("Skipping table creation for \\"audit.Users\\" because it already exists.");',
    );
    expect(migration?.content).toContain('await queryRunner.createTable(new Table({');
  });

  it('should allow disabling the Sequelize existing-table guard', async () => {
    const generator = new SequelizeGenerator();
    const migrations = await generator.generateMigrations(schema, undefined, {
      disableTableExistsCheck: true,
    });
    const migration = migrations.find((file) => file.fileName.includes('create-audit_Users'));

    expect(migration).toBeDefined();
    expect(migration?.content).not.toContain('queryInterface.tableExists(');
    expect(migration?.content).not.toContain('Skipping table creation for \\"audit.Users\\"');
  });

  it('should allow disabling the TypeORM existing-table guard', async () => {
    const generator = new TypeORMGenerator();
    const migrations = await generator.generateMigrations(schema, undefined, {
      disableTableExistsCheck: true,
    });
    const migration = migrations.find((file) => file.fileName.includes('CreateAudit_Users'));

    expect(migration).toBeDefined();
    expect(migration?.content).not.toContain('queryRunner.hasTable(');
    expect(migration?.content).not.toContain('Skipping table creation for \\"audit.Users\\"');
  });
});

import { ColumnMetadata, DatabaseSchema, TableData } from '../types/introspection';
import { filterAutoIncrementColumns } from '../utils/DataUtils';
import { topologicalSort } from '../utils/topologicalSort';
import {
  DataMigrationGenerator,
  GeneratedFile,
  MigrationGenerator,
  SchemaGenerator,
} from './GeneratorTypes';

export class TypeORMGenerator
  implements SchemaGenerator, MigrationGenerator, DataMigrationGenerator
{
  async generate(schema: DatabaseSchema): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    for (const table of schema.tables) {
      const className = this.formatModelName(table.name);
      const content = `import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('${table.name}')
${table.indexes
  .filter((idx) => !idx.isPrimary) // Primary keys are handled by @PrimaryColumn
  .map(
    (idx) =>
      `@Index('${idx.name}', ['${idx.columns.join("', '")}']${
        idx.isUnique ? ', { unique: true }' : ''
      })`,
  )
  .join('\n')}
export class ${className} {
${table.columns.map((c) => this.generateColumnDefinition(c)).join('\n')}
}
`;
      files.push({
        fileName: `${className}.ts`,
        content,
      });
    }

    return files;
  }

  async generateMigrations(schema: DatabaseSchema, data?: TableData[]): Promise<GeneratedFile[]> {
    const sortedTables = topologicalSort(schema);
    const files: GeneratedFile[] = [];
    const timestamp = Date.now();

    let counter = 0;
    for (const table of sortedTables) {
      counter++;
      const migrationName = `Create${this.formatModelName(table.name)}${timestamp + counter}`;
      const fileName = `${timestamp + counter}-${migrationName}.ts`;

      // Check if we have a named primary key
      const pkIndex = table.indexes.find((idx) => idx.isPrimary);
      const pkName = pkIndex ? pkIndex.name : undefined;

      const content = `import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class ${migrationName} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: '${table.name}',
      columns: [
${table.columns.map((c) => this.generateMigrationColumn(c)).join(',\n')}
      ],
      foreignKeys: [
${table.foreignKeys
  .map(
    (fk) =>
      `        {
          name: '${fk.name}',
          columnNames: ['${fk.columns.join("', '")}'],
          referencedTableName: '${fk.referencedTable}',
          referencedColumnNames: ['${fk.referencedColumns.join("', '")}'],
          onDelete: '${fk.deleteRule || 'NO ACTION'}',
          onUpdate: '${fk.updateRule || 'NO ACTION'}',
        }`,
  )
  .join(',\n')}
      ],
    }), true);

${table.indexes
  .filter((idx) => !idx.isPrimary)
  .map(
    (idx) =>
      `    await queryRunner.createIndex('${table.name}', new TableIndex({
      name: '${idx.name}',
      columnNames: ['${idx.columns.join("', '")}'],
      isUnique: ${idx.isUnique}
    }));`,
  )
  .join('\n')}
${
  pkName && pkName !== 'PRIMARY'
    ? `
    // Attempt to rename PK if needed, though TypeORM creates it with table creation.
    // Explicit named PK support in TypeORM migrations via createTable is limited in older versions.
    // If you need specific PK name, you might need to drop and recreate or use raw SQL.
    `
    : ''
}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('${table.name}');
  }
}
`;
      files.push({
        fileName,
        content,
      });

      // Check if there is data to be seeded for this table
      if (data) {
        const tableData = data.find((d) => d.tableName.toLowerCase() === table.name.toLowerCase());
        if (tableData) {
          counter++;
          const seedMigrationName = `Seed${this.formatModelName(tableData.tableName)}${
            timestamp + counter
          }`;
          const seedFileName = `${timestamp + counter}-${seedMigrationName}.ts`;
          const rows = filterAutoIncrementColumns(tableData);
          const rowsContent = JSON.stringify(rows, null, 2);

          const autoIncCol = tableData.columns.find((c) => c.isAutoIncrement);
          const autoIncColName = autoIncCol ? autoIncCol.name : null;

          const preInsert = tableData.disableIdentity
            ? `
    if (queryRunner.connection.driver.options.type === 'mssql') {
      await queryRunner.query('SET IDENTITY_INSERT "${tableData.tableName}" ON');
    }`
            : '';

          const postInsert = tableData.disableIdentity
            ? `
    if (queryRunner.connection.driver.options.type === 'mssql') {
      await queryRunner.query('SET IDENTITY_INSERT "${tableData.tableName}" OFF');
    } else if (queryRunner.connection.driver.options.type === 'postgres' && '${autoIncColName}') {
      await queryRunner.query('SELECT setval(pg_get_serial_sequence(\\'"${tableData.tableName}"\\', \\'${autoIncColName}\\'), MAX("${autoIncColName}")) FROM "${tableData.tableName}";');
    }`
            : '';

          const seedContent = `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${seedMigrationName} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (${rows.length} > 0) {${preInsert}
      await queryRunner.manager.createQueryBuilder()
        .insert()
        .into('${tableData.tableName}')
        .values(${rowsContent})
        .execute();${postInsert}
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`DELETE FROM "${tableData.tableName}"\`);
  }
}
`;
          files.push({
            fileName: seedFileName,
            content: seedContent,
          });
        }
      }
    }

    return files;
  }

  async generateDataMigrations(data: TableData[]): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    // Ensure data migrations always come after schema migrations by adding 10 seconds worth of milliseconds
    const timestamp = Date.now() + 10000;

    let counter = 0;
    for (const tableData of data) {
      counter++;
      const migrationName = `Seed${this.formatModelName(tableData.tableName)}${timestamp + counter}`;
      const fileName = `${timestamp + counter}-${migrationName}.ts`;

      const rows = filterAutoIncrementColumns(tableData);
      const rowsContent = JSON.stringify(rows, null, 2);

      const autoIncCol = tableData.columns.find((c) => c.isAutoIncrement);
      const autoIncColName = autoIncCol ? autoIncCol.name : null;

      const preInsert = tableData.disableIdentity
        ? `
    if (queryRunner.connection.driver.options.type === 'mssql') {
      await queryRunner.query('SET IDENTITY_INSERT "${tableData.tableName}" ON');
    }`
        : '';

      const postInsert = tableData.disableIdentity
        ? `
    if (queryRunner.connection.driver.options.type === 'mssql') {
      await queryRunner.query('SET IDENTITY_INSERT "${tableData.tableName}" OFF');
    } else if (queryRunner.connection.driver.options.type === 'postgres' && '${autoIncColName}') {
      await queryRunner.query('SELECT setval(pg_get_serial_sequence(\\'"${tableData.tableName}"\\', \\'${autoIncColName}\\'), MAX("${autoIncColName}")) FROM "${tableData.tableName}";');
    }`
        : '';

      const content = `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${migrationName} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (${rows.length} > 0) {${preInsert}
      await queryRunner.manager.createQueryBuilder()
        .insert()
        .into('${tableData.tableName}')
        .values(${rowsContent})
        .execute();${postInsert}
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`DELETE FROM "${tableData.tableName}"\`);
  }
}
`;
      files.push({
        fileName,
        content,
      });
    }

    return files;
  }

  private formatModelName(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  private mapType(dataType: string): string {
    const lower = dataType.toLowerCase();
    if (lower.includes('int')) return 'int';
    if (lower.includes('char') || lower.includes('text')) return 'varchar';
    if (lower.includes('bool')) return 'boolean';
    if (lower.includes('date') || lower.includes('time')) return 'timestamp';
    if (lower.includes('float') || lower.includes('double')) return 'float';
    return 'varchar';
  }

  private generateColumnDefinition(col: ColumnMetadata): string {
    const type = this.mapType(col.dataType);
    const decorator = col.isPrimaryKey ? '@PrimaryColumn' : '@Column';

    const options: string[] = [];
    if (type) options.push(`type: '${type}'`);
    if (col.isNullable) options.push('nullable: true');
    if (col.isUnique) options.push('unique: true');
    if (col.hasDefault && col.defaultValue) {
      options.push(`default: () => "${col.defaultValue.replace(/"/g, '\\"')}"`);
    }

    // TypeScript type
    let tsType = 'string';
    if (type === 'int' || type === 'float') tsType = 'number';
    if (type === 'boolean') tsType = 'boolean';
    if (type === 'timestamp') tsType = 'Date';

    return `  ${decorator}({ ${options.join(', ')} })
  ${col.name}${col.isNullable ? '?' : ''}: ${tsType};`;
  }

  private generateMigrationColumn(col: ColumnMetadata): string {
    const type = this.mapType(col.dataType);
    const parts = [`      name: '${col.name}'`, `      type: '${type}'`];

    if (col.isPrimaryKey) parts.push('      isPrimary: true');
    if (col.isAutoIncrement)
      parts.push('      isGenerated: true', "      generationStrategy: 'increment'");
    if (col.isNullable) parts.push('      isNullable: true');
    if (col.isUnique) parts.push('      isUnique: true');
    if (col.hasDefault && col.defaultValue) {
      parts.push(`      default: "${col.defaultValue.replace(/"/g, '\\"')}"`);
    }

    return `      {
${parts.join(',\n')}
      }`;
  }
}

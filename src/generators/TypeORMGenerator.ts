import { ColumnMetadata, DatabaseSchema, TableData } from '../types/introspection';
import { filterAutoIncrementColumns } from '../utils/DataUtils';
import { classifyDatabaseDefault, inferDefaultLogicalType } from '../utils/DefaultValueUtils';
import { getGeneratableIndexes } from '../utils/IndexUtils';
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
      const indexes = getGeneratableIndexes(table.indexes);
      const content = `import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('${table.name}')
${indexes
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
      const indexes = getGeneratableIndexes(table.indexes);

      // Check if we have a named primary key
      const pkIndex = indexes.find((idx) => idx.isPrimary);
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

${indexes
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
            ? String.raw`
    if (queryRunner.connection.driver.options.type === 'mssql') {
      await queryRunner.query('SET IDENTITY_INSERT "${tableData.tableName}" OFF');
    } else if (queryRunner.connection.driver.options.type === 'postgres' && '${autoIncColName}') {
      await queryRunner.query('SELECT setval(pg_get_serial_sequence(\'"${tableData.tableName}"\', \'${autoIncColName}\'), MAX("${autoIncColName}")) FROM "${tableData.tableName}";');
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
        ? String.raw`
    if (queryRunner.connection.driver.options.type === 'mssql') {
      await queryRunner.query('SET IDENTITY_INSERT "${tableData.tableName}" OFF');
    } else if (queryRunner.connection.driver.options.type === 'postgres' && '${autoIncColName}') {
      await queryRunner.query('SELECT setval(pg_get_serial_sequence(\'"${tableData.tableName}"\', \'${autoIncColName}\'), MAX("${autoIncColName}")) FROM "${tableData.tableName}";');
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

  private mapType(
    col: ColumnMetadata,
  ): { type: string; length?: string; tsType: 'string' | 'number' | 'boolean' | 'Date' } {
    const lower = col.dataType.toLowerCase();

    if (lower.includes('int')) return { type: 'int', tsType: 'number' };
    if (lower.includes('bool')) return { type: 'boolean', tsType: 'boolean' };
    if (lower.includes('date') || lower.includes('time'))
      return { type: 'timestamp', tsType: 'Date' };
    if (lower.includes('float') || lower.includes('double'))
      return { type: 'float', tsType: 'number' };
    if (lower.includes('decimal') || lower.includes('numeric'))
      return { type: 'decimal', tsType: 'number' };
    if (
      lower.includes('text') ||
      lower.includes('ntext') ||
      lower.includes('xml') ||
      col.maxLength === -1
    ) {
      return { type: 'text', tsType: 'string' };
    }
    if (lower.includes('nvarchar')) {
      return this.withLength('nvarchar', col.maxLength, 'string');
    }
    if (lower.includes('nchar')) {
      return this.withLength('nchar', col.maxLength, 'string');
    }
    if (lower.includes('varchar')) {
      return this.withLength('varchar', col.maxLength, 'string');
    }
    if (lower.includes('char')) {
      return this.withLength('char', col.maxLength, 'string');
    }

    return { type: 'varchar', tsType: 'string' };
  }

  private withLength(
    type: string,
    maxLength: number | null | undefined,
    tsType: 'string' | 'number' | 'boolean' | 'Date',
  ): { type: string; length?: string; tsType: 'string' | 'number' | 'boolean' | 'Date' } {
    if (maxLength && maxLength > 0) {
      return { type, length: String(maxLength), tsType };
    }

    return { type, tsType };
  }

  private generateColumnDefinition(col: ColumnMetadata): string {
    const mappedType = this.mapType(col);
    const decorator = col.isPrimaryKey ? '@PrimaryColumn' : '@Column';

    const options: string[] = [];
    options.push(`type: '${mappedType.type}'`);
    if (mappedType.length) options.push(`length: '${mappedType.length}'`);
    if (col.isNullable) options.push('nullable: true');
    if (col.isUnique) options.push('unique: true');
    if (col.hasDefault && col.defaultValue !== null && col.defaultValue !== undefined) {
      options.push(`default: ${this.formatTypeOrmDefaultValue(col)}`);
    }

    return `  ${decorator}({ ${options.join(', ')} })
  ${col.name}${col.isNullable ? '?' : ''}: ${mappedType.tsType};`;
  }

  private generateMigrationColumn(col: ColumnMetadata): string {
    const mappedType = this.mapType(col);
    const parts = [`      name: '${col.name}'`, `      type: '${mappedType.type}'`];

    if (col.isPrimaryKey) parts.push('      isPrimary: true');
    if (col.isAutoIncrement)
      parts.push('      isGenerated: true', "      generationStrategy: 'increment'");
    if (col.isNullable) parts.push('      isNullable: true');
    if (col.isUnique) parts.push('      isUnique: true');
    if (mappedType.length) parts.push(`      length: '${mappedType.length}'`);
    if (col.hasDefault && col.defaultValue !== null && col.defaultValue !== undefined) {
      parts.push(`      default: ${this.formatTypeOrmDefaultValue(col)}`);
    }

    return `      {
${parts.join(',\n')}
      }`;
  }

  private formatTypeOrmDefaultValue(col: ColumnMetadata): string {
    const classification = classifyDatabaseDefault(
      col.defaultValue ?? '',
      inferDefaultLogicalType(col.dataType),
    );

    switch (classification.kind) {
      case 'empty':
        return '""';
      case 'string':
        return JSON.stringify(classification.value);
      case 'number':
        return classification.value;
      case 'boolean':
        return classification.value ? 'true' : 'false';
      case 'date_now':
      case 'expression':
        return `() => ${JSON.stringify(classification.normalized)}`;
    }
  }

}

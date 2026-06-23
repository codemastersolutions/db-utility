import { ColumnMetadata, DatabaseSchema, TableData } from '../types/introspection';
import {
  formatMssqlQualifiedName,
  formatMssqlTypeReference,
  getEffectiveDataType,
  getUsedAliasTypes,
  inferEffectiveDefaultLogicalType,
} from '../utils/ColumnTypeUtils';
import { filterAutoIncrementColumns } from '../utils/DataUtils';
import { classifyDatabaseDefault } from '../utils/DefaultValueUtils';
import { getGeneratableIndexes } from '../utils/IndexUtils';
import {
  getQualifiedTableName,
  getTableDataKey,
  getTableKey,
  getUsedNonDefaultSchemaNames,
} from '../utils/TableNameUtils';
import { topologicalSort } from '../utils/topologicalSort';
import {
  DataMigrationGenerator,
  GeneratedFile,
  MigrationGenerationOptions,
  MigrationGenerator,
  SchemaGenerator,
} from './GeneratorTypes';

export class TypeORMGenerator
  implements SchemaGenerator, MigrationGenerator, DataMigrationGenerator
{
  async generate(schema: DatabaseSchema): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    for (const table of schema.tables) {
      const className = this.formatModelName(getQualifiedTableName(table));
      const indexes = getGeneratableIndexes(table.indexes);
      const entitySchema =
        table.schemaName && table.schemaName !== 'dbo' ? `, schema: '${table.schemaName}'` : '';
      const content = `import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity({ name: '${table.name}'${entitySchema} })
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

  async generateMigrations(
    schema: DatabaseSchema,
    data?: TableData[],
    options?: MigrationGenerationOptions,
  ): Promise<GeneratedFile[]> {
    const sortedTables = topologicalSort(schema);
    const files: GeneratedFile[] = [];
    const seedFiles: GeneratedFile[] = [];
    const foreignKeyFiles: GeneratedFile[] = [];
    const disableForeignKeys = options?.disableForeignKeys ?? false;
    const aliasTypes = getUsedAliasTypes(schema);
    const schemaNames = getUsedNonDefaultSchemaNames(schema);
    const tableDataByKey = new Map(
      (data ?? []).map((entry) => [getTableDataKey(entry), entry] as const),
    );
    const timestamp = Date.now();

    let counter = 0;

    for (const schemaName of schemaNames) {
      counter++;
      const migrationName = `CreateSchema${this.formatModelName(schemaName)}${timestamp + counter}`;
      const fileName = `${timestamp + counter}-${migrationName}.ts`;

      files.push({
        fileName,
        content: this.generateSchemaMigration(migrationName, schemaName),
      });
    }

    for (const aliasType of aliasTypes) {
      counter++;
      const migrationName = `CreateType${this.formatModelName(aliasType.schemaName)}${this.formatModelName(aliasType.name)}${timestamp + counter}`;
      const fileName = `${timestamp + counter}-${migrationName}.ts`;

      files.push({
        fileName,
        content: this.generateAliasTypeMigration(migrationName, aliasType),
      });
    }

    for (const table of sortedTables) {
      if (table.columns.length === 0) {
        continue;
      }

      counter++;
      const migrationName = `Create${this.formatModelName(getQualifiedTableName(table))}${timestamp + counter}`;
      const fileName = `${timestamp + counter}-${migrationName}.ts`;
      const indexes = getGeneratableIndexes(table.indexes);

      // Check if we have a named primary key
      const pkIndex = indexes.find((idx) => idx.isPrimary);
      const pkName = pkIndex ? pkIndex.name : undefined;

      const content = `import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class ${migrationName} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      ${table.schemaName ? `schema: '${table.schemaName}',` : ''}
      name: '${table.name}',
      columns: [
${table.columns.map((c) => this.generateMigrationColumn(c)).join(',\n')}
      ],
    }), true);

${indexes
  .filter((idx) => !idx.isPrimary)
  .map(
    (idx) =>
      `    await queryRunner.createIndex('${this.getTypeOrmTableReference(table.name, table.schemaName)}', new TableIndex({
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
    await queryRunner.dropTable('${this.getTypeOrmTableReference(table.name, table.schemaName)}');
  }
}
`;
      files.push({
        fileName,
        content,
      });
    }

    for (const table of sortedTables) {
      if (table.columns.length === 0) {
        continue;
      }

      const tableData = tableDataByKey.get(getTableKey(table));
      if (!tableData) {
        continue;
      }

      counter++;
      const seedMigrationName = `Seed${this.formatModelName(
        getQualifiedTableName({ name: tableData.tableName, schemaName: tableData.schemaName }),
      )}${timestamp + counter}`;
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
        .into('${this.getTypeOrmTableReference(tableData.tableName, tableData.schemaName)}')
        .values(${rowsContent})
        .execute();${postInsert}
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`DELETE FROM "${tableData.tableName}"\`);
  }
}
`;
      seedFiles.push({
        fileName: seedFileName,
        content: seedContent,
      });
    }

    if (!disableForeignKeys) {
      for (const table of sortedTables) {
        if (table.columns.length === 0 || table.foreignKeys.length === 0) {
          continue;
        }

        counter++;
        const migrationName = `AddFks${this.formatModelName(getQualifiedTableName(table))}${timestamp + counter}`;
        const fileName = `${timestamp + counter}-${migrationName}.ts`;
        const tableReference = this.getTypeOrmTableReference(table.name, table.schemaName);

        const content = `import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class ${migrationName} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
${table.foreignKeys
  .map(
    (fk) => `      await queryRunner.createForeignKey('${tableReference}', new TableForeignKey({
        name: '${fk.name}',
        columnNames: ['${fk.columns.join("', '")}'],
        referencedTableName: '${fk.referencedTable}',
        ${fk.referencedTableSchemaName ? `referencedSchema: '${fk.referencedTableSchemaName}',` : ''}
        referencedColumnNames: ['${fk.referencedColumns.join("', '")}'],
        onDelete: '${fk.deleteRule || 'NO ACTION'}',
        onUpdate: '${fk.updateRule || 'NO ACTION'}',
      }));`,
  )
  .join('\n')}
    } catch (error) {
      console.warn('Skipping FK creation for table ${table.name} due to error:', error.message);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
${table.foreignKeys
  .map((fk) => `      await queryRunner.dropForeignKey('${tableReference}', '${fk.name}');`)
  .join('\n')}
    } catch (error) {
      console.warn('Skipping FK removal for table ${table.name} due to error:', error.message);
    }
  }
}
`;
        foreignKeyFiles.push({
          fileName,
          content,
        });
      }
    }

    return [...files, ...seedFiles, ...foreignKeyFiles];
  }

  async generateDataMigrations(data: TableData[]): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    // Ensure data migrations always come after schema migrations by adding 10 seconds worth of milliseconds
    const timestamp = Date.now() + 10000;

    let counter = 0;
    for (const tableData of data) {
      counter++;
      const migrationName = `Seed${this.formatModelName(
        getQualifiedTableName({ name: tableData.tableName, schemaName: tableData.schemaName }),
      )}${timestamp + counter}`;
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
        .into('${this.getTypeOrmTableReference(tableData.tableName, tableData.schemaName)}')
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

  private getTypeOrmTableReference(tableName: string, schemaName?: string): string {
    return schemaName ? `${schemaName}.${tableName}` : tableName;
  }

  private mapType(col: ColumnMetadata): {
    type: string;
    length?: string;
    tsType: 'string' | 'number' | 'boolean' | 'Date' | 'Buffer';
  } {
    const lower = getEffectiveDataType(col).toLowerCase();

    if (lower.includes('int')) return { type: 'int', tsType: 'number' };
    if (lower.includes('bool')) return { type: 'boolean', tsType: 'boolean' };
    if (lower.includes('datetimeoffset')) return { type: 'datetimeoffset', tsType: 'Date' };
    if (lower.includes('datetime2')) return { type: 'datetime2', tsType: 'Date' };
    if (lower.includes('smalldatetime')) return { type: 'smalldatetime', tsType: 'Date' };
    if (lower === 'datetime') return { type: 'datetime', tsType: 'Date' };
    if (lower === 'date') return { type: 'date', tsType: 'Date' };
    if (lower === 'time') return { type: 'time', tsType: 'Date' };
    if (lower.includes('timestamp')) return { type: 'timestamp', tsType: 'Date' };
    if (lower.includes('date') || lower.includes('time')) return { type: lower, tsType: 'Date' };
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
    if (lower.includes('image')) {
      return { type: 'image', tsType: 'Buffer' };
    }
    if (lower.includes('varbinary')) {
      return this.withLength('varbinary', col.maxLength, 'Buffer');
    }
    if (lower.includes('binary')) {
      return this.withLength('binary', col.maxLength, 'Buffer');
    }
    if (lower.includes('blob')) {
      return { type: 'blob', tsType: 'Buffer' };
    }

    return { type: 'varchar', tsType: 'string' };
  }

  private withLength(
    type: string,
    maxLength: number | null | undefined,
    tsType: 'string' | 'number' | 'boolean' | 'Date' | 'Buffer',
  ): {
    type: string;
    length?: string;
    tsType: 'string' | 'number' | 'boolean' | 'Date' | 'Buffer';
  } {
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
      const defaultValue = this.formatTypeOrmDefaultValue(col);
      if (defaultValue !== null) {
        options.push(`default: ${defaultValue}`);
      }
    }

    return `  ${decorator}({ ${options.join(', ')} })
  ${col.name}${col.isNullable ? '?' : ''}: ${mappedType.tsType};`;
  }

  private generateMigrationColumn(col: ColumnMetadata): string {
    const mappedType = this.mapType(col);
    const parts = [
      `      name: '${col.name}'`,
      `      type: '${this.getMigrationType(col, mappedType.type)}'`,
    ];

    if (col.isPrimaryKey) parts.push('      isPrimary: true');
    if (col.isAutoIncrement)
      parts.push('      isGenerated: true', "      generationStrategy: 'increment'");
    if (col.isNullable) parts.push('      isNullable: true');
    if (col.isUnique) parts.push('      isUnique: true');
    if (mappedType.length) parts.push(`      length: '${mappedType.length}'`);
    if (col.hasDefault && col.defaultValue !== null && col.defaultValue !== undefined) {
      const defaultValue = this.formatTypeOrmDefaultValue(col);
      if (defaultValue !== null) {
        parts.push(`      default: ${defaultValue}`);
      }
    }

    return `      {
${parts.join(',\n')}
      }`;
  }

  private getMigrationType(col: ColumnMetadata, fallbackType: string): string {
    if (!col.aliasTypeName) {
      return fallbackType;
    }

    return formatMssqlQualifiedName(col.aliasTypeSchema ?? 'dbo', col.aliasTypeName);
  }

  private formatTypeOrmDefaultValue(col: ColumnMetadata): string | null {
    const classification = classifyDatabaseDefault(
      col.defaultValue ?? '',
      inferEffectiveDefaultLogicalType(col),
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
      case 'unsupported':
        return null;
    }
  }

  private generateAliasTypeMigration(
    migrationName: string,
    aliasType: NonNullable<DatabaseSchema['aliasTypes']>[number],
  ): string {
    const qualifiedName = formatMssqlQualifiedName(aliasType.schemaName, aliasType.name);
    const typeReference = formatMssqlTypeReference(aliasType);
    const nullability = aliasType.isNullable ? 'NULL' : 'NOT NULL';

    return `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${migrationName} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`IF TYPE_ID(N'${qualifiedName}') IS NULL EXEC(N'CREATE TYPE ${qualifiedName} FROM ${typeReference} ${nullability}');\`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`IF TYPE_ID(N'${qualifiedName}') IS NOT NULL DROP TYPE ${qualifiedName};\`);
  }
}
`;
  }

  private generateSchemaMigration(migrationName: string, schemaName: string): string {
    const escapedSchemaName = schemaName.replaceAll("'", "''");
    const escapedMssqlSchemaName = schemaName.replaceAll(']', ']]');
    const escapedPostgresSchemaName = schemaName.replaceAll('"', '""');

    return `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${migrationName} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const dialect = queryRunner.connection.driver.options.type;

    if (dialect === 'mssql') {
      await queryRunner.query(\`IF SCHEMA_ID(N'${escapedSchemaName}') IS NULL EXEC(N'CREATE SCHEMA [${escapedMssqlSchemaName}]');\`);
      return;
    }

    if (dialect === 'postgres') {
      await queryRunner.query(\`CREATE SCHEMA IF NOT EXISTS "${escapedPostgresSchemaName}"\`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Intentionally left as a no-op to avoid dropping pre-existing schemas.
  }
}
`;
  }
}

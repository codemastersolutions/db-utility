import {
  ColumnMetadata,
  DatabaseSchema,
} from '../types/introspection';
import { topologicalSort } from '../utils/topologicalSort';
import {
  GeneratedFile,
  MigrationGenerator,
  SchemaGenerator,
} from './GeneratorTypes';

export class TypeORMGenerator implements SchemaGenerator, MigrationGenerator {
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

  async generateMigrations(schema: DatabaseSchema): Promise<GeneratedFile[]> {
    const sortedTables = topologicalSort(schema);
    const files: GeneratedFile[] = [];
    const timestamp = Date.now();

    let counter = 0;
    for (const table of sortedTables) {
      counter++;
      const migrationName = `Create${this.formatModelName(table.name)}${timestamp + counter}`;
      const fileName = `${timestamp + counter}-${migrationName}.ts`;

      const content = `import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class ${migrationName} implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: '${table.name}',
            columns: [
${table.columns.map((c) => this.generateMigrationColumn(c)).join(',\n')}
            ],
        }), true);

        ${table.indexes
          .map(
            (idx) =>
              `await queryRunner.createIndex('${table.name}', new TableIndex({
                name: '${idx.name}',
                columnNames: ['${idx.columns.join("', '")}'],
                isUnique: ${idx.isUnique}
            }));`,
          )
          .join('\n        ')}
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
    const parts = [
      `                name: '${col.name}'`,
      `                type: '${type}'`,
    ];

    if (col.isPrimaryKey) parts.push('                isPrimary: true');
    if (col.isAutoIncrement) parts.push('                isGenerated: true', "                generationStrategy: 'increment'");
    if (col.isNullable) parts.push('                isNullable: true');
    if (col.isUnique) parts.push('                isUnique: true');
    if (col.hasDefault && col.defaultValue) {
         parts.push(`                default: "${col.defaultValue.replace(/"/g, '\\"')}"`);
    }

    return `                {
${parts.join(',\n')}
                }`;
  }
}

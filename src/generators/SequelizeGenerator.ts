import { ColumnMetadata, DatabaseSchema } from '../types/introspection';
import { topologicalSort } from '../utils/topologicalSort';
import { GeneratedFile, MigrationGenerator, SchemaGenerator } from './GeneratorTypes';

export class SequelizeGenerator implements SchemaGenerator, MigrationGenerator {
  async generate(schema: DatabaseSchema): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate Models
    for (const table of schema.tables) {
      const className = this.formatModelName(table.name);
      const content = `import { Model, DataTypes, Sequelize } from 'sequelize';

export class ${className} extends Model {}

export function init(sequelize: Sequelize) {
  ${className}.init(
    {
${table.columns.map((c) => this.generateColumnDefinition(c)).join(',\n')}
    },
    {
      sequelize,
      tableName: '${table.name}',
      timestamps: false, // Assuming no standard timestamps for now
    }
  );
  return ${className};
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
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);

    let counter = 0;
    for (const table of sortedTables) {
      counter++;
      const paddedCounter = String(counter).padStart(3, '0');
      const migrationName = `${timestamp}${paddedCounter}-create-${table.name}.js`;

      const content = `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('${table.name}', {
${table.columns.map((c) => this.generateMigrationColumn(c)).join(',\n')}
    });
    ${table.indexes
      .map(
        (idx) =>
          `await queryInterface.addIndex('${table.name}', ['${idx.columns.join(
            "','",
          )}'], { name: '${idx.name}', unique: ${idx.isUnique} });`,
      )
      .join('\n    ')}
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('${table.name}');
  }
};
`;
      files.push({
        fileName: migrationName,
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
    if (lower.includes('int')) return 'DataTypes.INTEGER';
    if (lower.includes('char') || lower.includes('text')) return 'DataTypes.STRING';
    if (lower.includes('bool')) return 'DataTypes.BOOLEAN';
    if (lower.includes('date') || lower.includes('time')) return 'DataTypes.DATE';
    if (lower.includes('float') || lower.includes('double') || lower.includes('decimal'))
      return 'DataTypes.FLOAT';
    return 'DataTypes.STRING';
  }

  private generateColumnDefinition(col: ColumnMetadata): string {
    const type = this.mapType(col.dataType);
    const parts = [`      type: ${type}`];

    if (col.isPrimaryKey) parts.push('      primaryKey: true');
    if (col.isAutoIncrement) parts.push('      autoIncrement: true');
    if (!col.isNullable) parts.push('      allowNull: false');
    if (col.isUnique) parts.push('      unique: true');
    if (col.hasDefault && col.defaultValue !== null) {
      parts.push(`      defaultValue: ${JSON.stringify(col.defaultValue)}`); // Simplification
    }

    return `      ${col.name}: {\n${parts.join(',\n')}\n      }`;
  }

  private generateMigrationColumn(col: ColumnMetadata): string {
    const type = this.mapType(col.dataType).replace('DataTypes.', 'Sequelize.');
    const parts = [`        type: ${type}`];

    if (col.isPrimaryKey) parts.push('        primaryKey: true');
    if (col.isAutoIncrement) parts.push('        autoIncrement: true');
    if (!col.isNullable) parts.push('        allowNull: false');
    if (col.isUnique) parts.push('        unique: true');
    if (col.hasDefault && col.defaultValue) {
      // Raw values might need cleaning, using string for safety
      parts.push(
        `        defaultValue: Sequelize.literal('${col.defaultValue.replace(/'/g, "\\'")}')`,
      );
    }

    return `      ${col.name}: {\n${parts.join(',\n')}\n      }`;
  }
}

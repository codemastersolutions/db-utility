import { ColumnMetadata, DatabaseSchema, TableData } from '../types/introspection';
import { filterAutoIncrementColumns } from '../utils/DataUtils';
import { classifyDatabaseDefault, inferDefaultLogicalType } from '../utils/DefaultValueUtils';
import { topologicalSort } from '../utils/topologicalSort';
import {
  DataMigrationGenerator,
  GeneratedFile,
  MigrationGenerator,
  SchemaGenerator,
} from './GeneratorTypes';

export class SequelizeGenerator
  implements SchemaGenerator, MigrationGenerator, DataMigrationGenerator
{
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
      timestamps: false,
      indexes: [
${table.indexes
  .filter((idx) => !idx.isPrimary)
  .map(
    (idx) =>
      `        { name: '${idx.name}', fields: ['${idx.columns.join("','")}'], unique: ${
        idx.isUnique
      } }`,
  )
  .join(',\n')}
      ]
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

  async generateMigrations(schema: DatabaseSchema, data?: TableData[]): Promise<GeneratedFile[]> {
    const sortedTables = topologicalSort(schema);
    const files: GeneratedFile[] = [];
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);

    let counter = 0;

    // 1. Create Tables, Constraints and Seeds
    for (const table of sortedTables) {
      counter++;
      const paddedCounter = String(counter).padStart(6, '0');
      const migrationName = `${timestamp}${paddedCounter}-create-${table.name}.js`;

      const tableData = data?.find((d) => d.tableName.toLowerCase() === table.name.toLowerCase());
      const hasAutoIncrement = table.columns.some((c) => c.isAutoIncrement);

      const createTablePart = `await queryInterface.createTable('${table.name}', {
${table.columns.map((c) => this.generateMigrationColumn(c, !hasAutoIncrement, false)).join(',\n')}
    });`;

      const pkConstraintsPart = hasAutoIncrement
        ? ''
        : table.indexes
            .filter((idx) => idx.isPrimary)
            .map(
              (idx) =>
                `await queryInterface.addConstraint('${table.name}', {
      fields: ['${idx.columns.join("','")}'],
      type: 'primary key',
      name: '${idx.name}'
    });`,
            )
            .join('\n    ');

      const indexesPart = table.indexes
        .filter((idx) => !idx.isPrimary)
        .map(
          (idx) =>
            `await queryInterface.addIndex('${table.name}', ['${idx.columns.join(
              "','",
            )}'], { name: '${idx.name}', unique: ${idx.isUnique} });`,
        )
        .join('\n    ');

      const upBody = [createTablePart, pkConstraintsPart, indexesPart]
        .filter((part) => part.trim().length > 0)
        .join('\n\n    ');

      const content = `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    ${upBody}
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

      // 2. Add Foreign Keys
      if (table.foreignKeys.length > 0) {
        counter++;
        const fkPaddedCounter = String(counter).padStart(6, '0');
        const fkMigrationName = `${timestamp}${fkPaddedCounter}-add-fks-${table.name}.js`;

        const fkContent = `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      ${table.foreignKeys
        .map(
          (fk) =>
            `await queryInterface.addConstraint('${table.name}', {
        fields: ['${fk.columns.join("','")}'],
        type: 'foreign key',
        name: '${fk.name}',
        references: {
          table: '${fk.referencedTable}',
          field: '${fk.referencedColumns[0]}'
        },
        onDelete: '${fk.deleteRule?.toLowerCase() || 'no action'}',
        onUpdate: '${fk.updateRule?.toLowerCase() || 'no action'}'
      });`,
        )
        .join('\n      ')}
    } catch (error) {
      console.warn('Skipping FK creation for table ${table.name} due to error:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      ${table.foreignKeys
        .map((fk) => `await queryInterface.removeConstraint('${table.name}', '${fk.name}');`)
        .join('\n      ')}
    } catch (error) {
      console.warn('Skipping FK removal for table ${table.name} due to error:', error.message);
    }
  }
};
`;
        files.push({
          fileName: fkMigrationName,
          content: fkContent,
        });
      }

      if (data) {
        if (tableData) {
          const disableIdentity = tableData.disableIdentity ?? false;
          counter++;
          const seedPaddedCounter = String(counter).padStart(6, '0');
          const seedMigrationName = `${timestamp}${seedPaddedCounter}-seed-${table.name}.js`;
          const rows = filterAutoIncrementColumns(tableData);
          const rowsContent = JSON.stringify(rows, null, 2);

          const autoIncCol = tableData.columns.find((c) => c.isAutoIncrement);
          const autoIncColName = autoIncCol ? autoIncCol.name : null;
          const hasAutoIncInData =
            autoIncColName && rows.length > 0 && Object.hasOwn(rows[0], autoIncColName);

          const useIdentityInsert = disableIdentity && !!hasAutoIncInData && !!autoIncColName;
          const usePostgresSequenceReset =
            disableIdentity && !!hasAutoIncInData && !!autoIncColName;

          let mssqlBatch = '';
          if (useIdentityInsert) {
            const statements = rows
              .map((row) => {
                const columns = Object.keys(row)
                  .map((c) => `[${c}]`)
                  .join(', ');
                const values = Object.values(row)
                  .map((value) => {
                    if (value === null || value === undefined) return 'NULL';
                    let normalized = value as unknown as string | number | boolean | Date | null;
                    if (normalized instanceof Date) {
                      normalized = normalized.toISOString();
                    } else if (typeof normalized === 'boolean') {
                      normalized = normalized ? 1 : 0;
                    }
                    const escaped = String(normalized).replaceAll("'", "''");
                    return `'${escaped}'`;
                  })
                  .join(', ');
                return `INSERT INTO [${table.name}] (${columns}) VALUES (${values});`;
              })
              .join(String.raw`\n`);
            mssqlBatch = String.raw`SET IDENTITY_INSERT [${table.name}] ON;\n${statements}\nSET IDENTITY_INSERT [${table.name}] OFF;`;
          }

          const identityInsertBlock = useIdentityInsert
            ? `
      if (dialect === 'mssql') {
        const sql = \`${mssqlBatch}\`;
        await queryInterface.sequelize.query(sql);
      } else {
        await queryInterface.sequelize.transaction(async (transaction) => {
          for (const row of data) {
            await queryInterface.bulkInsert('${table.name}', [row], { transaction });
          }${
            usePostgresSequenceReset && autoIncColName
              ? String.raw`
          if (dialect === 'postgres') {
            await queryInterface.sequelize.query('SELECT setval(pg_get_serial_sequence(\'"${table.name}"\', \'${autoIncColName}\'), MAX("${autoIncColName}")) FROM "${table.name}";', { transaction });
          }`
              : ''
          }
        });
      }`
            : `
      await queryInterface.sequelize.transaction(async (transaction) => {
        for (const row of data) {
          await queryInterface.bulkInsert('${table.name}', [row], { transaction });
        }
      });`;

          const seedContent = `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const data = ${rowsContent};
    if (data.length > 0) {
      const dialect = queryInterface.sequelize.getDialect();${identityInsertBlock}
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('${table.name}', null, {});
  }
};
`;
          files.push({
            fileName: seedMigrationName,
            content: seedContent,
          });
        }
      }
    }

    return files;
  }

  async generateDataMigrations(data: TableData[]): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    // Ensure data migrations always come after schema migrations by adding 10 seconds
    const date = new Date();
    date.setSeconds(date.getSeconds() + 10);
    const timestamp = date
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);

    let counter = 0;
    for (const tableData of data) {
      counter++;
      const paddedCounter = String(counter).padStart(6, '0');
      const migrationName = `${timestamp}${paddedCounter}-seed-${tableData.tableName}.js`;

      const rows = filterAutoIncrementColumns(tableData);
      const rowsContent = JSON.stringify(rows, null, 2);

      const autoIncCol = tableData.columns.find((c) => c.isAutoIncrement);
      const autoIncColName = autoIncCol ? autoIncCol.name : null;
      const hasAutoIncInData =
        autoIncColName && rows.length > 0 && Object.hasOwn(rows[0], autoIncColName);

      const disableIdentity = tableData.disableIdentity ?? false;
      const useIdentityInsert = disableIdentity && !!hasAutoIncInData && !!autoIncColName;
      const usePostgresSequenceReset = disableIdentity && !!hasAutoIncInData && !!autoIncColName;

      let mssqlBatch = '';
      if (useIdentityInsert) {
        const statements = rows
          .map((row) => {
            const columns = Object.keys(row)
              .map((c) => `[${c}]`)
              .join(', ');
            const values = Object.values(row)
              .map((value) => {
                if (value === null || value === undefined) return 'NULL';
                let normalized = value as unknown as string | number | boolean | Date | null;
                if (normalized instanceof Date) {
                  normalized = normalized.toISOString();
                } else if (typeof normalized === 'boolean') {
                  normalized = normalized ? 1 : 0;
                }
                const escaped = String(normalized).replaceAll("'", "''");
                return `'${escaped}'`;
              })
              .join(', ');
            return `INSERT INTO [${tableData.tableName}] (${columns}) VALUES (${values});`;
          })
          .join(String.raw`\n`);
        mssqlBatch = String.raw`SET IDENTITY_INSERT [${tableData.tableName}] ON;\n${statements}\nSET IDENTITY_INSERT [${tableData.tableName}] OFF;`;
      }

      const identityInsertBlock = useIdentityInsert
        ? `
      if (dialect === 'mssql') {
        const sql = \`${mssqlBatch}\`;
        await queryInterface.sequelize.query(sql);
      } else {
        await queryInterface.sequelize.transaction(async (transaction) => {
          for (const row of data) {
            await queryInterface.bulkInsert('${tableData.tableName}', [row], { transaction });
          }${
            usePostgresSequenceReset && autoIncColName
              ? String.raw`
          if (dialect === 'postgres') {
            await queryInterface.sequelize.query('SELECT setval(pg_get_serial_sequence(\'"${tableData.tableName}"\', \'${autoIncColName}\'), MAX("${autoIncColName}")) FROM "${tableData.tableName}";', { transaction });
          }`
              : ''
          }
        });
      }`
        : `
      await queryInterface.sequelize.transaction(async (transaction) => {
        for (const row of data) {
          await queryInterface.bulkInsert('${tableData.tableName}', [row], { transaction });
        }
      });`;

      const content = `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const data = ${rowsContent};
    if (data.length > 0) {
      const dialect = queryInterface.sequelize.getDialect();${identityInsertBlock}
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('${tableData.tableName}', null, {});
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

  private mapType(col: ColumnMetadata): string {
    const lower = col.dataType.toLowerCase();

    // Boolean
    if (lower === 'bit' || lower.includes('bool')) return 'DataTypes.BOOLEAN';

    // Integers
    if (lower.includes('tinyint')) return 'DataTypes.TINYINT';
    if (lower.includes('smallint')) return 'DataTypes.SMALLINT';
    if (lower.includes('mediumint')) return 'DataTypes.MEDIUMINT';
    if (lower.includes('bigint')) return 'DataTypes.BIGINT';
    if (lower.includes('int')) return 'DataTypes.INTEGER';

    // Floats / Decimals
    if (lower.includes('float')) return 'DataTypes.FLOAT';
    if (lower.includes('double')) return 'DataTypes.DOUBLE';
    if (lower.includes('decimal') || lower.includes('numeric') || lower.includes('money')) {
      if (
        col.numericPrecision !== null &&
        col.numericPrecision !== undefined &&
        col.numericScale !== null &&
        col.numericScale !== undefined
      ) {
        return `DataTypes.DECIMAL(${col.numericPrecision}, ${col.numericScale})`;
      }
      return 'DataTypes.DECIMAL';
    }

    // Dates
    if (lower === 'date') return 'DataTypes.DATEONLY';
    if (lower === 'time') return 'DataTypes.TIME';
    if (lower.includes('date') || lower.includes('time')) return 'DataTypes.DATE';

    // Strings
    if (
      lower.includes('text') ||
      lower.includes('ntext') ||
      lower.includes('image') ||
      lower.includes('xml')
    )
      return 'DataTypes.TEXT';

    if (lower.includes('char')) return this.mapStringType(col);

    // Binary
    if (lower.includes('binary') || lower.includes('blob')) return 'DataTypes.BLOB';

    // UUID
    if (lower.includes('uuid') || lower.includes('guid')) return 'DataTypes.UUID';

    return 'DataTypes.STRING';
  }

  private mapStringType(col: ColumnMetadata): string {
    if (col.maxLength === -1) return 'DataTypes.TEXT';

    if (col.maxLength && col.maxLength > 4000) {
      // Sequelize maps STRING to NVARCHAR on MSSQL. Large MSSQL strings such as
      // varchar(8000) become invalid bindings, so fall back to TEXT for safety.
      return 'DataTypes.TEXT';
    }

    if (col.maxLength && col.maxLength > 0) return `DataTypes.STRING(${col.maxLength})`;
    return 'DataTypes.STRING';
  }

  private generateColumnDefinition(col: ColumnMetadata): string {
    const type = this.mapType(col);
    const parts = [`      type: ${type}`];

    if (col.isPrimaryKey) parts.push('      primaryKey: true');
    if (col.isAutoIncrement) parts.push('      autoIncrement: true');
    if (!col.isNullable) parts.push('      allowNull: false');
    if (col.isUnique) parts.push('      unique: true');
    if (col.hasDefault && col.defaultValue !== null) {
      parts.push(`      defaultValue: ${this.formatSequelizeDefaultValue(col)}`);
    }

    return `      ${col.name}: {\n${parts.join(',\n')}\n      }`;
  }

  private generateMigrationColumn(
    col: ColumnMetadata,
    suppressPrimaryKey: boolean = false,
    suppressAutoIncrement: boolean = false,
  ): string {
    const type = this.mapType(col).replace('DataTypes.', 'Sequelize.');
    const parts = [`        type: ${type}`];

    if (col.isPrimaryKey && !suppressPrimaryKey) parts.push('        primaryKey: true');
    if (col.isAutoIncrement && !suppressAutoIncrement) parts.push('        autoIncrement: true');
    if (!col.isNullable) parts.push('        allowNull: false');
    if (col.isUnique) parts.push('        unique: true');
    if (col.hasDefault && col.defaultValue !== null && col.defaultValue !== undefined) {
      parts.push(`        defaultValue: ${this.formatSequelizeDefaultValue(col)}`);
    }

    return `      ${col.name}: {\n${parts.join(',\n')}\n      }`;
  }

  private formatSequelizeDefaultValue(col: ColumnMetadata): string {
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
        return `Sequelize.literal(${JSON.stringify(classification.normalized)})`;
    }
  }

}

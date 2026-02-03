import { ColumnMetadata, DatabaseSchema, TableData } from '../types/introspection';
import { filterAutoIncrementColumns } from '../utils/DataUtils';
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
      const disableIdentity = tableData?.disableIdentity ?? false;

      const hasAutoIncrement = table.columns.some((c) => c.isAutoIncrement);

      const createTablePart = `await queryInterface.createTable('${table.name}', {
${table.columns.map((c) => this.generateMigrationColumn(c, !hasAutoIncrement || disableIdentity, disableIdentity)).join(',\n')}
    });`;

      const pkConstraintsPart = !hasAutoIncrement && !disableIdentity
        ? table.indexes
            .filter((idx) => idx.isPrimary)
            .map(
              (idx) =>
                `await queryInterface.addConstraint('${table.name}', {
      fields: ['${idx.columns.join("','")}'],
      type: 'primary key',
      name: '${idx.name}'
    });`,
            )
            .join('\n    ')
        : '';

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

      // 1.5 Add PKs if disableIdentity is true
      if (disableIdentity) {
        counter++;
        const pkPaddedCounter = String(counter).padStart(6, '0');
        const pkMigrationName = `${timestamp}${pkPaddedCounter}-add-pks-${table.name}.js`;

        const pkContent = `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      ${table.indexes
        .filter((idx) => idx.isPrimary)
        .map(
          (idx) =>
            `await queryInterface.addConstraint('${table.name}', {
        fields: ['${idx.columns.join("','")}'],
        type: 'primary key',
        name: '${idx.name}'
      });`,
        )
        .join('\n      ')}
    } catch (error) {
      console.warn('Skipping PK creation for table ${table.name} due to error:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      ${table.indexes
        .filter((idx) => idx.isPrimary)
        .map((idx) => `await queryInterface.removeConstraint('${table.name}', '${idx.name}');`)
        .join('\n      ')}
    } catch (error) {
      console.warn('Skipping PK removal for table ${table.name} due to error:', error.message);
    }
  }
};
`;
        files.push({
          fileName: pkMigrationName,
          content: pkContent,
        });
      }

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

      // Check if there is data to be seeded for this table
      if (data) {
        // We already have tableData from earlier
        if (tableData) {
          counter++;
          const seedPaddedCounter = String(counter).padStart(6, '0');
          const seedMigrationName = `${timestamp}${seedPaddedCounter}-seed-${table.name}.js`;
          const rows = filterAutoIncrementColumns(tableData);
          const rowsContent = JSON.stringify(rows, null, 2);

          const autoIncCol = tableData.columns.find((c) => c.isAutoIncrement);
          const autoIncColName = autoIncCol ? autoIncCol.name : null;
          const hasAutoIncInData =
            autoIncColName &&
            rows.length > 0 &&
            Object.prototype.hasOwnProperty.call(rows[0], autoIncColName);

          // Only use SET IDENTITY_INSERT if we have auto-inc data AND we didn't disable identity creation
          const enableIdentity = hasAutoIncInData && !disableIdentity;

          const preInsert = enableIdentity
            ? `
        const dialect = queryInterface.sequelize.getDialect();
        if (dialect === 'mssql') {
          await queryInterface.sequelize.query('SET IDENTITY_INSERT "${table.name}" ON', { transaction });
        }`
            : '';

          const postInsertSimplified = enableIdentity
            ? `
        if (dialect === 'mssql') {
          await queryInterface.sequelize.query('SET IDENTITY_INSERT "${table.name}" OFF', { transaction });
        } else if (dialect === 'postgres' && '${autoIncColName}') {
          await queryInterface.sequelize.query('SELECT setval(pg_get_serial_sequence(\\'"${table.name}"\\', \\'${autoIncColName}\\'), MAX("${autoIncColName}")) FROM "${table.name}";', { transaction });
        }`
            : '';

          const seedContent = `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const data = ${rowsContent};
    if (data.length > 0) {
      await queryInterface.sequelize.transaction(async (transaction) => {${preInsert}
        for (const row of data) {
          await queryInterface.bulkInsert('${table.name}', [row], { transaction });
        }${postInsertSimplified}
      });
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

          // 4. Enable Identity if it was disabled
           if (disableIdentity && hasAutoIncrement && autoIncColName && autoIncCol) {
             counter++;
             const enableIdPaddedCounter = String(counter).padStart(6, '0');
             const enableIdMigrationName = `${timestamp}${enableIdPaddedCounter}-enable-identity-${table.name}.js`;

             const type = this.mapType(autoIncCol).replace('DataTypes.', 'Sequelize.');

             const enableIdContent = `'use strict';

 module.exports = {
   async up(queryInterface, Sequelize) {
     const dialect = queryInterface.sequelize.getDialect();
     try {
         if (dialect === 'postgres' || dialect === 'mysql') {
             await queryInterface.changeColumn('${table.name}', '${autoIncColName}', {
                 type: ${type},
                 autoIncrement: true,
                 primaryKey: ${autoIncCol.isPrimaryKey},
                 allowNull: ${!autoIncCol.isNullable},
                 unique: ${autoIncCol.isUnique}
             });

             if (dialect === 'postgres') {
                 await queryInterface.sequelize.query('SELECT setval(pg_get_serial_sequence(\\'"${table.name}"\\', \\'${autoIncColName}\\'), MAX("${autoIncColName}")) FROM "${table.name}";');
             }
         } else {
              console.warn('Enabling identity for ${table.name} is not fully supported for this dialect in this migration step.');
         }
     } catch (error) {
         console.warn('Error enabling identity for ${table.name}:', error.message);
     }
   },

   async down(queryInterface, Sequelize) {
     // Reverting identity change is complex and might not be needed for basic rollback
   }
 };
 `;
             files.push({
                 fileName: enableIdMigrationName,
                 content: enableIdContent
             });
           }
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

      const content = `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const data = ${rowsContent};
    if (data.length > 0) {
      await queryInterface.sequelize.transaction(async (transaction) => {
        for (const row of data) {
          await queryInterface.bulkInsert('${tableData.tableName}', [row], { transaction });
        }
      });
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

      if (tableData.disableIdentity && autoIncColName && autoIncCol) {
        counter++;
        const enableIdPaddedCounter = String(counter).padStart(6, '0');
        const enableIdMigrationName = `${timestamp}${enableIdPaddedCounter}-enable-identity-${tableData.tableName}.js`;

        const type = this.mapType(autoIncCol).replace('DataTypes.', 'Sequelize.');

        const enableIdContent = `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    try {
        if (dialect === 'postgres' || dialect === 'mysql') {
            await queryInterface.changeColumn('${tableData.tableName}', '${autoIncColName}', {
                type: ${type},
                autoIncrement: true,
                primaryKey: ${autoIncCol.isPrimaryKey},
                allowNull: ${!autoIncCol.isNullable},
                unique: ${autoIncCol.isUnique}
            });

            if (dialect === 'postgres') {
                await queryInterface.sequelize.query('SELECT setval(pg_get_serial_sequence(\\'"${tableData.tableName}"\\', \\'${autoIncColName}\\'), MAX("${autoIncColName}")) FROM "${tableData.tableName}";');
            }
        } else {
             console.warn('Enabling identity for ${tableData.tableName} is not fully supported for this dialect in this migration step.');
        }
    } catch (error) {
        console.warn('Error enabling identity for ${tableData.tableName}:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // Reverting identity change is complex and might not be needed for basic rollback
  }
};
`;
        files.push({
          fileName: enableIdMigrationName,
          content: enableIdContent,
        });
      }
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

    if (lower.includes('char')) {
      // char, varchar, nchar, nvarchar
      if (col.maxLength === -1) return 'DataTypes.TEXT';
      if (col.maxLength && col.maxLength > 0) return `DataTypes.STRING(${col.maxLength})`;
      return 'DataTypes.STRING';
    }

    // Binary
    if (lower.includes('binary') || lower.includes('blob')) return 'DataTypes.BLOB';

    // UUID
    if (lower.includes('uuid') || lower.includes('guid')) return 'DataTypes.UUID';

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
      parts.push(`      defaultValue: ${JSON.stringify(col.defaultValue)}`); // Simplification
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
    if (col.hasDefault && col.defaultValue) {
      // Raw values might need cleaning, using string for safety
      parts.push(
        `        defaultValue: Sequelize.literal('${col.defaultValue.replace(/'/g, "\\'")}')`,
      );
    }

    return `      ${col.name}: {\n${parts.join(',\n')}\n      }`;
  }
}

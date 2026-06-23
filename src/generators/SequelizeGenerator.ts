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
  formatMssqlQualifiedTableName,
  getUsedNonDefaultSchemaNames,
  getQualifiedTableName,
  getTableDataKey,
  getTableKey,
} from '../utils/TableNameUtils';
import { topologicalSort } from '../utils/topologicalSort';
import {
  DataMigrationGenerator,
  GeneratedFile,
  MigrationGenerationOptions,
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
      const className = this.formatModelName(getQualifiedTableName(table));
      const indexes = getGeneratableIndexes(table.indexes);
      const schemaOption =
        table.schemaName && table.schemaName !== 'dbo'
          ? `,\n      schema: '${table.schemaName}'`
          : '';
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
      timestamps: false${schemaOption},
      indexes: [
${indexes
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
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);

    let counter = 0;

    for (const schemaName of schemaNames) {
      counter++;
      const paddedCounter = String(counter).padStart(6, '0');
      const migrationName = `${timestamp}${paddedCounter}-create-schema-${schemaName}.js`;

      files.push({
        fileName: migrationName,
        content: this.generateSchemaMigration(schemaName),
      });
    }

    for (const aliasType of aliasTypes) {
      counter++;
      const paddedCounter = String(counter).padStart(6, '0');
      const migrationName = `${timestamp}${paddedCounter}-create-type-${aliasType.schemaName}-${aliasType.name}.js`;

      files.push({
        fileName: migrationName,
        content: this.generateAliasTypeMigration(aliasType),
      });
    }

    // 1. Create all tables first
    for (const table of sortedTables) {
      if (table.columns.length === 0) {
        continue;
      }

      counter++;
      const paddedCounter = String(counter).padStart(6, '0');
      const migrationName = `${timestamp}${paddedCounter}-create-${getQualifiedTableName(table)}.js`;

      const hasAutoIncrement = table.columns.some((c) => c.isAutoIncrement);
      const indexes = getGeneratableIndexes(table.indexes);
      const tableReference = this.serializeTableReference(table.name, table.schemaName);

      const createTablePart = `await queryInterface.createTable(${tableReference}, {
${table.columns.map((c) => this.generateMigrationColumn(c, !hasAutoIncrement, false)).join(',\n')}
    });`;

      const pkConstraintsPart = hasAutoIncrement
        ? ''
        : indexes
            .filter((idx) => idx.isPrimary)
            .map(
              (idx) =>
                `await queryInterface.addConstraint(${tableReference}, {
      fields: ['${idx.columns.join("','")}'],
      type: 'primary key',
      name: '${idx.name}'
    });`,
            )
            .join('\n    ');

      const indexesPart = indexes
        .filter((idx) => !idx.isPrimary)
        .map(
          (idx) =>
            `await queryInterface.addIndex(${tableReference}, ['${idx.columns.join(
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
    await queryInterface.dropTable(${tableReference});
  }
};
`;
      files.push({
        fileName: migrationName,
        content,
      });
    }

    // 2. Seed all data after every table exists
    for (const table of sortedTables) {
      if (table.columns.length === 0) {
        continue;
      }

      const tableData = tableDataByKey.get(getTableKey(table));
      if (!tableData) {
        continue;
      }

      const disableIdentity = tableData.disableIdentity ?? false;
      counter++;
      const seedPaddedCounter = String(counter).padStart(6, '0');
      const seedMigrationName = `${timestamp}${seedPaddedCounter}-seed-${getQualifiedTableName(table)}.js`;
      const rows = filterAutoIncrementColumns(tableData);
      const rowsContent = JSON.stringify(rows, null, 2);
      const seedHelpers = this.generateSeedRuntimeHelpers();
      const tableDataReference = this.serializeTableReference(
        tableData.tableName,
        tableData.schemaName,
      );

      const autoIncCol = tableData.columns.find((c) => c.isAutoIncrement);
      const autoIncColName = autoIncCol ? autoIncCol.name : null;
      const hasAutoIncInData =
        autoIncColName && rows.length > 0 && Object.hasOwn(rows[0], autoIncColName);

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
              .map((value) => this.formatMssqlSeedValue(value))
              .join(', ');
            return `INSERT INTO ${formatMssqlQualifiedTableName(tableData)} (${columns}) VALUES (${values});`;
          })
          .join(String.raw`\n`);
        const qualifiedTableName = formatMssqlQualifiedTableName(tableData);
        mssqlBatch = String.raw`SET IDENTITY_INSERT ${qualifiedTableName} ON;\n${statements}\nSET IDENTITY_INSERT ${qualifiedTableName} OFF;`;
      }

      const identityInsertBlock = useIdentityInsert
        ? `
      if (dialect === 'mssql') {
        const sql = \`${mssqlBatch}\`;
        await queryInterface.sequelize.query(sql);
      } else {
        await queryInterface.sequelize.transaction(async (transaction) => {
          for (const row of data) {
            await queryInterface.bulkInsert(${tableDataReference}, [row], { transaction });
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
          await queryInterface.bulkInsert(${tableDataReference}, [row], { transaction });
        }
      });`;

      const seedContent = `'use strict';

${seedHelpers}

module.exports = {
  async up(queryInterface, Sequelize) {
    const data = reviveSeedRows(${rowsContent});
    if (data.length > 0) {
      const dialect = queryInterface.sequelize.getDialect();${identityInsertBlock}
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(${tableDataReference}, null, {});
  }
};
`;
      seedFiles.push({
        fileName: seedMigrationName,
        content: seedContent,
      });
    }

    // 3. Add foreign keys only after every seed has been applied
    if (!disableForeignKeys) {
      for (const table of sortedTables) {
        if (table.columns.length === 0 || table.foreignKeys.length === 0) {
          continue;
        }

        counter++;
        const paddedCounter = String(counter).padStart(6, '0');
        const migrationName = `${timestamp}${paddedCounter}-add-fks-${getQualifiedTableName(table)}.js`;
        const tableReference = this.serializeTableReference(table.name, table.schemaName);

        const fkContent = `'use strict';

function getForeignKeyErrorMessage(error) {
  const candidates = [
    error?.message,
    error?.original?.message,
    error?.parent?.message,
    error?.cause?.message,
    error?.sqlMessage,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);

  if (candidates.length > 0) {
    return candidates[0];
  }

  try {
    const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}));
    if (serialized && serialized !== '{}') {
      return serialized;
    }
  } catch {
    // Ignore JSON serialization issues and fall back to string coercion.
  }

  const fallback = String(error ?? '');
  return fallback.trim().length > 0 ? fallback : 'Unknown error';
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const failures = [];
    ${table.foreignKeys
      .map((fk) => {
        const referencedTableReference = this.serializeTableReference(
          fk.referencedTable,
          fk.referencedTableSchemaName,
        );
        return `try {
      await queryInterface.addConstraint(${tableReference}, {
        fields: ['${fk.columns.join("','")}'],
        type: 'foreign key',
        name: '${fk.name}',
        references: {
          table: ${referencedTableReference},
          ${this.generateForeignKeyReference(fk.referencedColumns)}
        },
        onDelete: '${fk.deleteRule?.toLowerCase() || 'no action'}',
        onUpdate: '${fk.updateRule?.toLowerCase() || 'no action'}'
      });
    } catch (error) {
      const reason = getForeignKeyErrorMessage(error);
      failures.push('FK ${fk.name}: ' + reason);
      console.warn('Failed to create FK ${fk.name} on table ${table.name}:', reason);
    }`;
      })
      .join('\n    ')}

    if (failures.length > 0) {
      throw new Error('Foreign key creation failed for table ${table.name}: ' + failures.join(' | '));
    }
  },

  async down(queryInterface, Sequelize) {
    const failures = [];
    ${table.foreignKeys
      .map(
        (fk) => `try {
      await queryInterface.removeConstraint(${tableReference}, '${fk.name}');
    } catch (error) {
      const reason = getForeignKeyErrorMessage(error);
      failures.push('FK ${fk.name}: ' + reason);
      console.warn('Failed to remove FK ${fk.name} on table ${table.name}:', reason);
    }`,
      )
      .join('\n    ')}

    if (failures.length > 0) {
      throw new Error('Foreign key removal failed for table ${table.name}: ' + failures.join(' | '));
    }
  }
};
`;
        foreignKeyFiles.push({
          fileName: migrationName,
          content: fkContent,
        });
      }
    }

    return [...files, ...seedFiles, ...foreignKeyFiles];
  }

  private generateForeignKeyReference(referencedColumns: string[]): string {
    if (referencedColumns.length <= 1) {
      return `field: '${referencedColumns[0]}'`;
    }

    return `fields: ['${referencedColumns.join("','")}']`;
  }

  private generateAliasTypeMigration(
    aliasType: NonNullable<DatabaseSchema['aliasTypes']>[number],
  ): string {
    const qualifiedName = formatMssqlQualifiedName(aliasType.schemaName, aliasType.name);
    const typeReference = formatMssqlTypeReference(aliasType);
    const nullability = aliasType.isNullable ? 'NULL' : 'NOT NULL';

    return `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(\`IF TYPE_ID(N'${qualifiedName}') IS NULL EXEC(N'CREATE TYPE ${qualifiedName} FROM ${typeReference} ${nullability}');\`);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(\`IF TYPE_ID(N'${qualifiedName}') IS NOT NULL DROP TYPE ${qualifiedName};\`);
  }
};
`;
  }

  private generateSchemaMigration(schemaName: string): string {
    const escapedSchemaName = schemaName.replaceAll("'", "''");
    const escapedMssqlSchemaName = schemaName.replaceAll(']', ']]');
    const escapedPostgresSchemaName = schemaName.replaceAll('"', '""');

    return `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'mssql') {
      await queryInterface.sequelize.query(\`IF SCHEMA_ID(N'${escapedSchemaName}') IS NULL EXEC(N'CREATE SCHEMA [${escapedMssqlSchemaName}]');\`);
      return;
    }

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(\`CREATE SCHEMA IF NOT EXISTS "${escapedPostgresSchemaName}"\`);
    }
  },

  async down(queryInterface, Sequelize) {
    // Intentionally left as a no-op to avoid dropping pre-existing schemas.
  }
};
`;
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
      const migrationName = `${timestamp}${paddedCounter}-seed-${getQualifiedTableName({
        name: tableData.tableName,
        schemaName: tableData.schemaName,
      })}.js`;

      const rows = filterAutoIncrementColumns(tableData);
      const rowsContent = JSON.stringify(rows, null, 2);
      const seedHelpers = this.generateSeedRuntimeHelpers();
      const tableDataReference = this.serializeTableReference(
        tableData.tableName,
        tableData.schemaName,
      );

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
              .map((value) => this.formatMssqlSeedValue(value))
              .join(', ');
            return `INSERT INTO ${formatMssqlQualifiedTableName(tableData)} (${columns}) VALUES (${values});`;
          })
          .join(String.raw`\n`);
        const qualifiedTableName = formatMssqlQualifiedTableName(tableData);
        mssqlBatch = String.raw`SET IDENTITY_INSERT ${qualifiedTableName} ON;\n${statements}\nSET IDENTITY_INSERT ${qualifiedTableName} OFF;`;
      }

      const identityInsertBlock = useIdentityInsert
        ? `
      if (dialect === 'mssql') {
        const sql = \`${mssqlBatch}\`;
        await queryInterface.sequelize.query(sql);
      } else {
        await queryInterface.sequelize.transaction(async (transaction) => {
          for (const row of data) {
            await queryInterface.bulkInsert(${tableDataReference}, [row], { transaction });
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
          await queryInterface.bulkInsert(${tableDataReference}, [row], { transaction });
        }
      });`;

      const content = `'use strict';

${seedHelpers}

module.exports = {
  async up(queryInterface, Sequelize) {
    const data = reviveSeedRows(${rowsContent});
    if (data.length > 0) {
      const dialect = queryInterface.sequelize.getDialect();${identityInsertBlock}
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(${tableDataReference}, null, {});
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

  private serializeTableReference(tableName: string, schemaName?: string): string {
    if (!schemaName) {
      return `'${tableName}'`;
    }

    return `{ tableName: '${tableName}', schema: '${schemaName}' }`;
  }

  private generateSeedRuntimeHelpers(): string {
    return `function reviveSeedValue(value) {
  if (Array.isArray(value)) {
    return value.map(reviveSeedValue);
  }

  if (value && typeof value === 'object') {
    if (value.type === 'Buffer' && Array.isArray(value.data)) {
      return Buffer.from(value.data);
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, reviveSeedValue(entryValue)]),
    );
  }

  return value;
}

function reviveSeedRows(rows) {
  return rows.map((row) => reviveSeedValue(row));
}`;
  }

  private formatMssqlSeedValue(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';

    if (Buffer.isBuffer(value)) {
      return `0x${value.toString('hex')}`;
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      'data' in value &&
      value.type === 'Buffer' &&
      Array.isArray(value.data)
    ) {
      return `0x${Buffer.from(value.data).toString('hex')}`;
    }

    if (value instanceof Date) {
      return `'${value.toISOString().replaceAll("'", "''")}'`;
    }

    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }

    const serializedObjectValue = JSON.stringify(value);
    const scalarValue =
      typeof value === 'string'
        ? value
        : (serializedObjectValue ?? Object.prototype.toString.call(value));
    const escaped = scalarValue.replaceAll("'", "''");
    return `'${escaped}'`;
  }

  private mapType(col: ColumnMetadata): string {
    const lower = getEffectiveDataType(col).toLowerCase();

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
    if (lower.includes('text') || lower.includes('ntext') || lower.includes('xml'))
      return 'DataTypes.TEXT';

    if (lower.includes('char')) return this.mapStringType(col);

    // Binary
    if (lower.includes('image') || lower.includes('binary') || lower.includes('blob'))
      return 'DataTypes.BLOB';

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
      const defaultValue = this.formatSequelizeDefaultValue(col);
      if (defaultValue !== null) {
        parts.push(`      defaultValue: ${defaultValue}`);
      }
    }

    return `      ${col.name}: {\n${parts.join(',\n')}\n      }`;
  }

  private generateMigrationColumn(
    col: ColumnMetadata,
    suppressPrimaryKey: boolean = false,
    suppressAutoIncrement: boolean = false,
  ): string {
    const type = this.getMigrationType(col);
    const parts = [`        type: ${type}`];

    if (col.isPrimaryKey && !suppressPrimaryKey) parts.push('        primaryKey: true');
    if (col.isAutoIncrement && !suppressAutoIncrement) parts.push('        autoIncrement: true');
    if (!col.isNullable) parts.push('        allowNull: false');
    if (col.isUnique) parts.push('        unique: true');
    if (col.hasDefault && col.defaultValue !== null && col.defaultValue !== undefined) {
      const defaultValue = this.formatSequelizeDefaultValue(col);
      if (defaultValue !== null) {
        parts.push(`        defaultValue: ${defaultValue}`);
      }
    }

    return `      ${col.name}: {\n${parts.join(',\n')}\n      }`;
  }

  private getMigrationType(col: ColumnMetadata): string {
    if (col.aliasTypeName) {
      const schemaName = col.aliasTypeSchema ?? 'dbo';
      const qualifiedAliasType = formatMssqlQualifiedName(schemaName, col.aliasTypeName);
      return JSON.stringify(qualifiedAliasType);
    }

    return this.mapType(col).replace('DataTypes.', 'Sequelize.');
  }

  private formatSequelizeDefaultValue(col: ColumnMetadata): string | null {
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
        return `Sequelize.literal(${JSON.stringify(classification.normalized)})`;
      case 'unsupported':
        return null;
    }
  }
}

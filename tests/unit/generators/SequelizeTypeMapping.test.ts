import { describe, it, expect } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { ColumnMetadata, DatabaseSchema } from '../../../src/types/introspection';

describe('SequelizeGenerator Type Mapping', () => {
  const generator = new SequelizeGenerator();

  // Helper to access private mapType method (via type assertion or by testing public method that uses it)
  // Since mapType is private, we'll test generateColumnDefinition or generateMigrationColumn logic
  // But generateMigrationColumn is private too.
  // We'll test 'generate' or 'generateMigrations' output.

  const createSchema = (col: ColumnMetadata): DatabaseSchema => ({
    tables: [
      {
        name: 'TestTable',
        columns: [col],
        indexes: [],
        foreignKeys: [],
      },
    ],
  });

  it('should map varchar(max) to DataTypes.TEXT', async () => {
    const col: ColumnMetadata = {
      name: 'description',
      dataType: 'varchar',
      maxLength: -1, // MAX
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generate(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('description: {');
    expect(content).toContain('type: DataTypes.TEXT');
  });

  it('should map varchar(100) to DataTypes.STRING(100)', async () => {
    const col: ColumnMetadata = {
      name: 'title',
      dataType: 'varchar',
      maxLength: 100,
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generate(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('title: {');
    expect(content).toContain('type: DataTypes.STRING(100)');
  });

  it('should map varchar(8000) to DataTypes.TEXT to avoid invalid MSSQL nvarchar bindings', async () => {
    const col: ColumnMetadata = {
      name: 'valorStr',
      dataType: 'varchar',
      maxLength: 8000,
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generateMigrations(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('valorStr: {');
    expect(content).toContain('type: Sequelize.TEXT');
    expect(content).not.toContain('Sequelize.STRING(8000)');
  });

  it('should keep nvarchar(4000) as DataTypes.STRING(4000)', async () => {
    const col: ColumnMetadata = {
      name: 'descricao',
      dataType: 'nvarchar',
      maxLength: 4000,
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generate(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('descricao: {');
    expect(content).toContain('type: DataTypes.STRING(4000)');
  });

  it('should map text to DataTypes.TEXT', async () => {
    const col: ColumnMetadata = {
      name: 'content',
      dataType: 'text',
      maxLength: 2147483647, // often ignored for text type itself
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generate(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('content: {');
    expect(content).toContain('type: DataTypes.TEXT');
  });

  it('should map decimal(10, 2) correctly', async () => {
    const col: ColumnMetadata = {
      name: 'price',
      dataType: 'decimal',
      numericPrecision: 10,
      numericScale: 2,
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generate(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('price: {');
    expect(content).toContain('type: DataTypes.DECIMAL(10, 2)');
  });

  it('should map bit to DataTypes.BOOLEAN', async () => {
    const col: ColumnMetadata = {
      name: 'isActive',
      dataType: 'bit',
      isNullable: false,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const files = await generator.generate(createSchema(col));
    const content = files[0].content;

    expect(content).toContain('isActive: {');
    expect(content).toContain('type: DataTypes.BOOLEAN');
  });

  it('should create alias type migrations before table creation and preserve the alias type in migrations', async () => {
    const schema: DatabaseSchema = {
      aliasTypes: [
        {
          name: 'DIMAGEM',
          schemaName: 'dbo',
          baseDataType: 'image',
          isNullable: true,
        },
      ],
      tables: [
        {
          name: 'GIMAGEM',
          columns: [
            {
              name: 'IMAGEM',
              dataType: 'DIMAGEM',
              primitiveDataType: 'image',
              aliasTypeName: 'DIMAGEM',
              aliasTypeSchema: 'dbo',
              isNullable: true,
              hasDefault: false,
              isPrimaryKey: false,
              isUnique: false,
              isAutoIncrement: false,
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };

    const files = await generator.generateMigrations(schema);
    const models = await generator.generate(schema);

    expect(files[0]?.fileName).toContain('create-type-dbo-DIMAGEM');
    expect(files[0]?.content).toContain('CREATE TYPE [dbo].[DIMAGEM] FROM image NULL');
    expect(files[1]?.fileName).toContain('create-GIMAGEM');
    expect(files[1]?.content).toContain('IMAGEM: {');
    expect(files[1]?.content).toContain('type: "[dbo].[DIMAGEM]"');
    expect(models[0]?.content).toContain('type: DataTypes.BLOB');
  });

  it('should generate schema-aware table references for homonymous MSSQL tables', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'GUSUARIO',
          schemaName: 'dbo',
          columns: [
            {
              name: 'CODUSUARIO',
              dataType: 'varchar',
              maxLength: 20,
              isNullable: false,
              hasDefault: false,
              isPrimaryKey: true,
              isUnique: false,
              isAutoIncrement: false,
            },
          ],
          indexes: [
            { name: 'PKGUSUARIO', columns: ['CODUSUARIO'], isPrimary: true, isUnique: true },
          ],
          foreignKeys: [],
        },
        {
          name: 'GUSUARIO',
          schemaName: 'rm',
          columns: [
            {
              name: 'LOGID',
              dataType: 'bigint',
              isNullable: false,
              hasDefault: false,
              isPrimaryKey: true,
              isUnique: false,
              isAutoIncrement: false,
            },
          ],
          indexes: [
            {
              name: 'PK__GUSUARIO__E39E279EA197A050',
              columns: ['LOGID'],
              isPrimary: true,
              isUnique: true,
            },
          ],
          foreignKeys: [],
        },
      ],
    };

    const files = await generator.generateMigrations(schema);

    expect(files).toHaveLength(3);
    expect(files[0]?.fileName).toContain('create-schema-rm');
    expect(files[1]?.fileName).toContain('create-GUSUARIO');
    expect(files[1]?.content).toContain("{ tableName: 'GUSUARIO', schema: 'dbo' }");
    expect(files[2]?.fileName).toContain('create-rm_GUSUARIO');
    expect(files[2]?.content).toContain("{ tableName: 'GUSUARIO', schema: 'rm' }");
    expect(files[1]?.content).toContain("name: 'PKGUSUARIO'");
    expect(files[2]?.content).toContain("name: 'PK__GUSUARIO__E39E279EA197A050'");
  });

  it('should skip migrations for tables without columns', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'dtproperties',
          schemaName: 'dbo',
          columns: [],
          indexes: [],
          foreignKeys: [],
        },
        {
          name: 'Users',
          schemaName: 'dbo',
          columns: [
            {
              name: 'id',
              dataType: 'int',
              isNullable: false,
              hasDefault: false,
              isPrimaryKey: true,
              isUnique: false,
              isAutoIncrement: false,
            },
          ],
          indexes: [{ name: 'PKUsers', columns: ['id'], isPrimary: true, isUnique: true }],
          foreignKeys: [],
        },
      ],
    };

    const files = await generator.generateMigrations(schema);

    expect(files).toHaveLength(1);
    expect(files[0]?.fileName).toContain('create-Users');
    expect(files[0]?.fileName).not.toContain('dtproperties');
    expect(files[0]?.content).not.toContain("tableName: 'dtproperties'");
  });

  it('should create non-default schemas before tables', async () => {
    const schema: DatabaseSchema = {
      tables: [
        {
          name: 'AggregatedCounter',
          schemaName: 'HangFire',
          columns: [
            {
              name: 'Key',
              dataType: 'varchar',
              maxLength: 100,
              isNullable: false,
              hasDefault: false,
              isPrimaryKey: true,
              isUnique: false,
              isAutoIncrement: false,
            },
          ],
          indexes: [
            { name: 'PKAggregatedCounter', columns: ['Key'], isPrimary: true, isUnique: true },
          ],
          foreignKeys: [],
        },
      ],
    };

    const files = await generator.generateMigrations(schema);

    expect(files[0]?.fileName).toContain('create-schema-HangFire');
    expect(files[0]?.content).toContain("IF SCHEMA_ID(N'HangFire') IS NULL");
    expect(files[1]?.fileName).toContain('create-HangFire_AggregatedCounter');
    expect(files[1]?.content).toContain("{ tableName: 'AggregatedCounter', schema: 'HangFire' }");
  });
});

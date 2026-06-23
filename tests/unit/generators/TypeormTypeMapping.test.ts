import { describe, expect, it } from 'vitest';
import { TypeORMGenerator } from '../../../src/generators/TypeORMGenerator';
import { ColumnMetadata, DatabaseSchema } from '../../../src/types/introspection';

describe('TypeORMGenerator Type Mapping', () => {
  const generator = new TypeORMGenerator();

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

  it('should preserve varchar(8000) with explicit length in migrations', async () => {
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

    const [migration] = await generator.generateMigrations(createSchema(col));

    expect(migration.content).toContain("type: 'varchar'");
    expect(migration.content).toContain("length: '8000'");
  });

  it('should preserve nvarchar(100) with explicit length in models', async () => {
    const col: ColumnMetadata = {
      name: 'descricao',
      dataType: 'nvarchar',
      maxLength: 100,
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const [model] = await generator.generate(createSchema(col));

    expect(model.content).toContain("@Column({ type: 'nvarchar', length: '100', nullable: true })");
  });

  it('should map varchar(max) to text in migrations', async () => {
    const col: ColumnMetadata = {
      name: 'observacao',
      dataType: 'varchar',
      maxLength: -1,
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const [migration] = await generator.generateMigrations(createSchema(col));

    expect(migration.content).toContain("type: 'text'");
    expect(migration.content).not.toContain("length: '-1'");
  });

  it('should preserve datetimeoffset in migrations', async () => {
    const col: ColumnMetadata = {
      name: 'dataFechamento',
      dataType: 'datetimeoffset',
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const [migration] = await generator.generateMigrations(createSchema(col));

    expect(migration.content).toContain("type: 'datetimeoffset'");
    expect(migration.content).not.toContain("type: 'timestamp'");
  });

  it('should preserve datetime in models', async () => {
    const col: ColumnMetadata = {
      name: 'criadoEm',
      dataType: 'datetime',
      isNullable: true,
      hasDefault: false,
      isPrimaryKey: false,
      isUnique: false,
      isAutoIncrement: false,
    };

    const [model] = await generator.generate(createSchema(col));

    expect(model.content).toContain("@Column({ type: 'datetime', nullable: true })");
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

    expect(files[0]?.fileName).toContain('CreateTypeDboDIMAGEM');
    expect(files[0]?.content).toContain('CREATE TYPE [dbo].[DIMAGEM] FROM image NULL');
    expect(files[1]?.content).toContain("name: 'IMAGEM'");
    expect(files[1]?.content).toContain("type: '[dbo].[DIMAGEM]'");
    expect(models[0]?.content).toContain("@Column({ type: 'image', nullable: true })");
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

    expect(files[0]?.fileName).toContain('CreateSchemaHangFire');
    expect(files[0]?.content).toContain("IF SCHEMA_ID(N'HangFire') IS NULL");
    expect(files[1]?.fileName).toContain('CreateHangFire_AggregatedCounter');
    expect(files[1]?.content).toContain("schema: 'HangFire'");
    expect(files[1]?.content).toContain("name: 'AggregatedCounter'");
  });
});

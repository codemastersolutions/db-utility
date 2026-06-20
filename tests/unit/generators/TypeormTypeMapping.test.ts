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
});

import { describe, expect, it } from 'vitest';
import { MongooseGenerator } from '../../../src/generators/MongooseGenerator';
import { PrismaGenerator } from '../../../src/generators/PrismaGenerator';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { TypeORMGenerator } from '../../../src/generators/TypeORMGenerator';
import { DatabaseSchema } from '../../../src/types/introspection';

function createColumn(name: string) {
  return {
    name,
    dataType: 'varchar',
    isPrimaryKey: false,
    isAutoIncrement: false,
    isNullable: true,
    hasDefault: false,
    isUnique: false,
    maxLength: 50,
  };
}

describe('Index Limit Handling', () => {
  const oversizedIndexColumns = Array.from({ length: 33 }, (_, index) => `COL_${index + 1}`);

  const schema: DatabaseSchema = {
    tables: [
      {
        name: 'LPUBLIC',
        columns: oversizedIndexColumns.map((columnName) => createColumn(columnName)),
        indexes: [
          { name: 'IDX_VALID', columns: ['COL_1', 'COL_2'], isPrimary: false, isUnique: false },
          {
            name: 'LXLPUBLIC_01',
            columns: oversizedIndexColumns,
            isPrimary: false,
            isUnique: false,
          },
        ],
        foreignKeys: [],
      },
    ],
  };

  it('should skip oversized indexes in Sequelize outputs', async () => {
    const generator = new SequelizeGenerator();
    const [model] = await generator.generate(schema);
    const [migration] = await generator.generateMigrations(schema);

    expect(model.content).toContain("name: 'IDX_VALID'");
    expect(model.content).not.toContain('LXLPUBLIC_01');
    expect(migration.content).toContain("name: 'IDX_VALID'");
    expect(migration.content).not.toContain('LXLPUBLIC_01');
  });

  it('should skip oversized indexes in TypeORM outputs', async () => {
    const generator = new TypeORMGenerator();
    const [model] = await generator.generate(schema);
    const [migration] = await generator.generateMigrations(schema);

    expect(model.content).toContain("@Index('IDX_VALID', ['COL_1', 'COL_2'])");
    expect(model.content).not.toContain('LXLPUBLIC_01');
    expect(migration.content).toContain("name: 'IDX_VALID'");
    expect(migration.content).not.toContain('LXLPUBLIC_01');
  });

  it('should skip oversized indexes in Prisma output', async () => {
    const generator = new PrismaGenerator();
    const [schemaFile] = await generator.generate(schema);

    expect(schemaFile.content).toContain('@@index([COL_1, COL_2], map: "IDX_VALID")');
    expect(schemaFile.content).not.toContain('LXLPUBLIC_01');
  });

  it('should skip oversized indexes in Mongoose output', async () => {
    const generator = new MongooseGenerator();
    const [model] = await generator.generate(schema);

    expect(model.content).toContain("LPUBLICSchema.index({ COL_1: 1, COL_2: 1 }, { name: 'IDX_VALID'");
    expect(model.content).not.toContain('LXLPUBLIC_01');
  });
});

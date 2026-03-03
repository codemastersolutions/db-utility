import { describe, it, expect } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { TypeORMGenerator } from '../../../src/generators/TypeORMGenerator';
import { PrismaGenerator } from '../../../src/generators/PrismaGenerator';
import { DatabaseSchema } from '../../../src/types/introspection';

describe('Model Export Generation', () => {
  const schema: DatabaseSchema = {
    tables: [
      {
        name: 'Users',
        columns: [
          {
            name: 'id',
            dataType: 'int',
            isPrimaryKey: true,
            isAutoIncrement: true,
            isNullable: false,
            hasDefault: false,
            isUnique: true,
          },
          {
            name: 'email',
            dataType: 'varchar',
            isPrimaryKey: false,
            isAutoIncrement: false,
            isNullable: false,
            hasDefault: false,
            isUnique: true,
            maxLength: 255,
          },
          {
            name: 'name',
            dataType: 'varchar',
            isPrimaryKey: false,
            isAutoIncrement: false,
            isNullable: true,
            hasDefault: false,
            isUnique: false,
            maxLength: 100,
          },
        ],
        indexes: [
          { name: 'pk_users', columns: ['id'], isPrimary: true, isUnique: true },
          { name: 'idx_users_email', columns: ['email'], isPrimary: false, isUnique: true },
        ],
        foreignKeys: [],
      },
    ],
  };

  it('SequelizeGenerator should include indexes in model init options', async () => {
    const generator = new SequelizeGenerator();
    const files = await generator.generate(schema);
    const content = files[0].content;

    expect(content).toContain('export class Users extends Model {}');
    expect(content).toContain('tableName: \'Users\'');
    expect(content).toContain('indexes: [');
    expect(content).toContain("{ name: 'idx_users_email', fields: ['email'], unique: true }");
  });

  it('TypeORMGenerator should include @Index decorators for non-primary indexes', async () => {
    const generator = new TypeORMGenerator();
    const files = await generator.generate(schema);
    const content = files[0].content;

    expect(content).toContain("@Entity('Users')");
    expect(content).toContain("@Index('idx_users_email', ['email'], { unique: true })");
  });

  it('PrismaGenerator should include @@id and @@unique/@@index mappings', async () => {
    const generator = new PrismaGenerator();
    const files = await generator.generate(schema);
    const content = files[0].content;

    expect(content).toContain('model Users {');
    expect(content).toContain('@@id([id], map: "pk_users")');
    expect(content).toContain('@@unique([email], map: "idx_users_email")');
    expect(content).toContain('@@map("Users")');
  });
});

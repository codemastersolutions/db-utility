import { describe, expect, it, vi } from 'vitest';
import { SequelizeGenerator } from '../../../src/generators/SequelizeGenerator';
import { IntrospectionService } from '../../../src/introspection/IntrospectionService';
import { IDatabaseConnector } from '../../../src/types/database';

describe('MSSQL Foreign Key Pipeline', () => {
  it('should preserve composite referenced columns when generating Sequelize migrations', async () => {
    const connector: IDatabaseConnector = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getVersion: vi.fn(),
      query: vi
        .fn()
        .mockResolvedValueOnce([{ table_name: 'FCFO' }, { table_name: 'XXCONTRATO' }])
        .mockResolvedValueOnce([
          {
            table_name: 'FCFO',
            column_name: 'CODCOLIGADA',
            data_type: 'smallint',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 5,
            numeric_scale: 0,
            is_identity: 0,
          },
          {
            table_name: 'FCFO',
            column_name: 'CODCFO',
            data_type: 'varchar',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: 25,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: 0,
          },
          {
            table_name: 'XXCONTRATO',
            column_name: 'CODCOLIGADA',
            data_type: 'smallint',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 5,
            numeric_scale: 0,
            is_identity: 0,
          },
          {
            table_name: 'XXCONTRATO',
            column_name: 'NUMCONTRATO',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 10,
            numeric_scale: 0,
            is_identity: 0,
          },
          {
            table_name: 'XXCONTRATO',
            column_name: 'CODCOLIGADACONTRATADA',
            data_type: 'smallint',
            is_nullable: 'YES',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 5,
            numeric_scale: 0,
            is_identity: 0,
          },
          {
            table_name: 'XXCONTRATO',
            column_name: 'CODCONTRATADA',
            data_type: 'varchar',
            is_nullable: 'YES',
            column_default: null,
            character_maximum_length: 25,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: 0,
          },
        ])
        .mockResolvedValueOnce([
          {
            table_name: 'FCFO',
            column_name: 'CODCOLIGADA',
          },
          {
            table_name: 'FCFO',
            column_name: 'CODCFO',
          },
          {
            table_name: 'XXCONTRATO',
            column_name: 'CODCOLIGADA',
          },
          {
            table_name: 'XXCONTRATO',
            column_name: 'NUMCONTRATO',
          },
        ])
        .mockResolvedValueOnce([
          {
            table_name: 'FCFO',
            index_name: 'PKFCFO',
            is_unique: true,
            is_primary: true,
            column_name: 'CODCOLIGADA',
            key_ordinal: 1,
            is_included_column: false,
          },
          {
            table_name: 'FCFO',
            index_name: 'PKFCFO',
            is_unique: true,
            is_primary: true,
            column_name: 'CODCFO',
            key_ordinal: 2,
            is_included_column: false,
          },
          {
            table_name: 'XXCONTRATO',
            index_name: 'PKXXCONTRATO',
            is_unique: true,
            is_primary: true,
            column_name: 'CODCOLIGADA',
            key_ordinal: 1,
            is_included_column: false,
          },
          {
            table_name: 'XXCONTRATO',
            index_name: 'PKXXCONTRATO',
            is_unique: true,
            is_primary: true,
            column_name: 'NUMCONTRATO',
            key_ordinal: 2,
            is_included_column: false,
          },
        ])
        .mockResolvedValueOnce([
          {
            constraint_name: 'FKXXCONTRATO_FCFO',
            table_name: 'XXCONTRATO',
            column_name: 'CODCOLIGADACONTRATADA',
            referenced_table_name: 'FCFO',
            referenced_column_name: 'CODCOLIGADA',
            update_rule: 'NO ACTION',
            delete_rule: 'NO ACTION',
          },
          {
            constraint_name: 'FKXXCONTRATO_FCFO',
            table_name: 'XXCONTRATO',
            column_name: 'CODCONTRATADA',
            referenced_table_name: 'FCFO',
            referenced_column_name: 'CODCFO',
            update_rule: 'NO ACTION',
            delete_rule: 'NO ACTION',
          },
        ]),
    };

    const service = new IntrospectionService(connector, { type: 'mssql' });
    const schema = await service.introspect();
    const generator = new SequelizeGenerator();
    const migrations = await generator.generateMigrations(schema);
    const fkMigration = migrations.find((migration) => migration.fileName.includes('add-fks'));

    expect(fkMigration?.content).toContain("fields: ['CODCOLIGADACONTRATADA','CODCONTRATADA']");
    expect(fkMigration?.content).toContain("table: 'FCFO'");
    expect(fkMigration?.content).toContain("fields: ['CODCOLIGADA','CODCFO']");
    expect(fkMigration?.content).not.toContain("field: 'CODCOLIGADA'");
  });
});

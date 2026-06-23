import { describe, expect, it, vi } from 'vitest';
import { MssqlIntrospector } from '../../../src/introspection/MssqlIntrospector';
import { IDatabaseConnector } from '../../../src/types/database';

describe('MssqlIntrospector', () => {
  it('should treat boolean is_identity values from MSSQL as auto increment columns', async () => {
    const connector: IDatabaseConnector = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getVersion: vi.fn(),
      query: vi
        .fn()
        .mockResolvedValueOnce([{ schema_name: 'dbo', table_name: 'Users' }])
        .mockResolvedValueOnce([
          {
            schema_name: 'dbo',
            table_name: 'Users',
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 10,
            numeric_scale: 0,
            is_identity: true,
          },
          {
            schema_name: 'dbo',
            table_name: 'Users',
            column_name: 'name',
            data_type: 'nvarchar',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: 100,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: false,
          },
        ])
        .mockResolvedValueOnce([{ schema_name: 'dbo', table_name: 'Users', column_name: 'id' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };

    const introspector = new MssqlIntrospector(connector);
    const schema = await introspector.introspectSchema();
    const idColumn = schema.tables[0].columns.find((column) => column.name === 'id');

    expect(idColumn?.isAutoIncrement).toBe(true);
  });

  it('should normalize MSSQL column defaults without removing valid SQL expressions', async () => {
    const connector: IDatabaseConnector = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getVersion: vi.fn(),
      query: vi
        .fn()
        .mockResolvedValueOnce([{ table_name: 'Users' }])
        .mockResolvedValueOnce([
          {
            table_name: 'Users',
            column_name: 'status',
            data_type: 'smallint',
            is_nullable: 'NO',
            column_default: '((0))',
            character_maximum_length: null,
            numeric_precision: 5,
            numeric_scale: 0,
            is_identity: 0,
          },
          {
            table_name: 'Users',
            column_name: 'name',
            data_type: 'nvarchar',
            is_nullable: 'NO',
            column_default: "(N'guest')",
            character_maximum_length: 100,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: 0,
          },
          {
            table_name: 'Users',
            column_name: 'createdAt',
            data_type: 'datetime',
            is_nullable: 'NO',
            column_default: '(getdate())',
            character_maximum_length: null,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: 0,
          },
          {
            table_name: 'Users',
            column_name: 'legacyDefault',
            data_type: 'smallint',
            is_nullable: 'NO',
            column_default: 'CREATE DEFAULT DEF_DLOGICNULL AS 0\r\nFOR [customSql]',
            character_maximum_length: null,
            numeric_precision: 5,
            numeric_scale: 0,
            is_identity: 0,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };

    const introspector = new MssqlIntrospector(connector);
    const schema = await introspector.introspectSchema();
    const columns = schema.tables[0].columns;

    expect(columns.find((column) => column.name === 'status')?.defaultValue).toBe('0');
    expect(columns.find((column) => column.name === 'name')?.defaultValue).toBe("N'guest'");
    expect(columns.find((column) => column.name === 'createdAt')?.defaultValue).toBe('getdate()');
    expect(columns.find((column) => column.name === 'legacyDefault')?.defaultValue).toBe('0');
  });

  it('should keep included columns out of the index key list', async () => {
    const connector: IDatabaseConnector = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getVersion: vi.fn(),
      query: vi
        .fn()
        .mockResolvedValueOnce([{ table_name: 'LPUBLIC' }])
        .mockResolvedValueOnce([
          {
            table_name: 'LPUBLIC',
            column_name: 'ID',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 10,
            numeric_scale: 0,
            is_identity: 0,
          },
          {
            table_name: 'LPUBLIC',
            column_name: 'COL_A',
            data_type: 'varchar',
            is_nullable: 'YES',
            column_default: null,
            character_maximum_length: 50,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: 0,
          },
          {
            table_name: 'LPUBLIC',
            column_name: 'COL_B',
            data_type: 'varchar',
            is_nullable: 'YES',
            column_default: null,
            character_maximum_length: 50,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: 0,
          },
          {
            table_name: 'LPUBLIC',
            column_name: 'COL_C',
            data_type: 'varchar',
            is_nullable: 'YES',
            column_default: null,
            character_maximum_length: 50,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: 0,
          },
          {
            table_name: 'LPUBLIC',
            column_name: 'COL_D',
            data_type: 'varchar',
            is_nullable: 'YES',
            column_default: null,
            character_maximum_length: 50,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: 0,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            table_name: 'LPUBLIC',
            index_name: 'LXLPUBLIC_01',
            is_unique: false,
            is_primary: false,
            column_name: 'COL_A',
            key_ordinal: 1,
            is_included_column: false,
          },
          {
            table_name: 'LPUBLIC',
            index_name: 'LXLPUBLIC_01',
            is_unique: false,
            is_primary: false,
            column_name: 'COL_B',
            key_ordinal: 2,
            is_included_column: false,
          },
          {
            table_name: 'LPUBLIC',
            index_name: 'LXLPUBLIC_01',
            is_unique: false,
            is_primary: false,
            column_name: 'COL_C',
            key_ordinal: 0,
            is_included_column: true,
          },
          {
            table_name: 'LPUBLIC',
            index_name: 'LXLPUBLIC_01',
            is_unique: false,
            is_primary: false,
            column_name: 'COL_D',
            key_ordinal: 0,
            is_included_column: true,
          },
        ])
        .mockResolvedValueOnce([]),
    };

    const introspector = new MssqlIntrospector(connector);
    const schema = await introspector.introspectSchema();
    const index = schema.tables[0].indexes[0];

    expect(index.columns).toEqual(['COL_A', 'COL_B']);
    expect(index.includedColumns).toEqual(['COL_C', 'COL_D']);
  });

  it('should preserve composite foreign keys with matching referenced columns order', async () => {
    const connector: IDatabaseConnector = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getVersion: vi.fn(),
      query: vi
        .fn()
        .mockResolvedValueOnce([{ table_name: 'XXCONTRATO' }, { table_name: 'FCFO' }])
        .mockResolvedValueOnce([
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
        ])
        .mockResolvedValueOnce([])
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

    const introspector = new MssqlIntrospector(connector);
    const schema = await introspector.introspectSchema();
    const contratoTable = schema.tables.find((table) => table.name === 'XXCONTRATO');
    const foreignKey = contratoTable?.foreignKeys[0];

    expect(foreignKey?.columns).toEqual(['CODCOLIGADACONTRATADA', 'CODCONTRATADA']);
    expect(foreignKey?.referencedColumns).toEqual(['CODCOLIGADA', 'CODCFO']);
  });

  it('should load alias types and preserve the primitive type for alias-backed columns', async () => {
    const connector: IDatabaseConnector = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getVersion: vi.fn(),
      query: vi
        .fn()
        .mockResolvedValueOnce([{ table_name: 'GIMAGEM' }])
        .mockResolvedValueOnce([
          {
            table_name: 'GIMAGEM',
            column_name: 'IMAGEM',
            data_type: 'DIMAGEM',
            primitive_data_type: 'image',
            alias_type_name: 'DIMAGEM',
            alias_type_schema: 'dbo',
            is_nullable: 'YES',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: 0,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            type_name: 'DIMAGEM',
            schema_name: 'dbo',
            base_data_type: 'image',
            max_length: null,
            numeric_precision: null,
            numeric_scale: null,
            is_nullable: true,
          },
        ]),
    };

    const introspector = new MssqlIntrospector(connector);
    const schema = await introspector.introspectSchema();
    const column = schema.tables[0]?.columns[0];

    expect(column?.dataType).toBe('DIMAGEM');
    expect(column?.primitiveDataType).toBe('image');
    expect(column?.aliasTypeName).toBe('DIMAGEM');
    expect(column?.aliasTypeSchema).toBe('dbo');
    expect(schema.aliasTypes).toEqual([
      {
        name: 'DIMAGEM',
        schemaName: 'dbo',
        baseDataType: 'image',
        maxLength: null,
        numericPrecision: null,
        numericScale: null,
        isNullable: true,
      },
    ]);
  });

  it('should keep homonymous tables from different schemas separated', async () => {
    const connector: IDatabaseConnector = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getVersion: vi.fn(),
      query: vi
        .fn()
        .mockResolvedValueOnce([
          { schema_name: 'dbo', table_name: 'GUSUARIO' },
          { schema_name: 'rm', table_name: 'GUSUARIO' },
        ])
        .mockResolvedValueOnce([
          {
            schema_name: 'dbo',
            table_name: 'GUSUARIO',
            column_name: 'CODUSUARIO',
            data_type: 'varchar',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: 20,
            numeric_precision: null,
            numeric_scale: null,
            is_identity: 0,
          },
          {
            schema_name: 'rm',
            table_name: 'GUSUARIO',
            column_name: 'LOGID',
            data_type: 'bigint',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 19,
            numeric_scale: 0,
            is_identity: 0,
          },
        ])
        .mockResolvedValueOnce([
          { schema_name: 'dbo', table_name: 'GUSUARIO', column_name: 'CODUSUARIO' },
          { schema_name: 'rm', table_name: 'GUSUARIO', column_name: 'LOGID' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };

    const introspector = new MssqlIntrospector(connector);
    const schema = await introspector.introspectSchema();
    const dboUser = schema.tables.find(
      (table) => table.schemaName === 'dbo' && table.name === 'GUSUARIO',
    );
    const rmUser = schema.tables.find(
      (table) => table.schemaName === 'rm' && table.name === 'GUSUARIO',
    );

    expect(schema.tables).toHaveLength(2);
    expect(dboUser?.columns.map((column) => column.name)).toEqual(['CODUSUARIO']);
    expect(rmUser?.columns.map((column) => column.name)).toEqual(['LOGID']);
    expect(dboUser?.columns[0]?.isPrimaryKey).toBe(true);
    expect(rmUser?.columns[0]?.isPrimaryKey).toBe(true);
  });

  it('should skip tables that have no introspected columns', async () => {
    const connector: IDatabaseConnector = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getVersion: vi.fn(),
      query: vi
        .fn()
        .mockResolvedValueOnce([
          { schema_name: 'dbo', table_name: 'dtproperties' },
          { schema_name: 'dbo', table_name: 'Users' },
        ])
        .mockResolvedValueOnce([
          {
            schema_name: 'dbo',
            table_name: 'Users',
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 10,
            numeric_scale: 0,
            is_identity: 0,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };

    const introspector = new MssqlIntrospector(connector);
    const schema = await introspector.introspectSchema();

    expect(schema.tables.map((table) => table.name)).toEqual(['Users']);
  });
});

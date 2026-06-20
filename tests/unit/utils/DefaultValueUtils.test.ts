import { describe, expect, it } from 'vitest';
import {
  classifyDatabaseDefault,
  inferDefaultLogicalType,
  normalizeDatabaseDefault,
} from '../../../src/utils/DefaultValueUtils';

describe('DefaultValueUtils', () => {
  it('should normalize legacy MSSQL defaults and unwrap redundant parentheses', () => {
    expect(normalizeDatabaseDefault('CREATE DEFAULT DEF_STATUS AS ((0)) FOR [status]')).toBe('0');
    expect(normalizeDatabaseDefault("(N'guest')")).toBe("N'guest'");
    expect(normalizeDatabaseDefault('(getdate())')).toBe('getdate()');
  });

  it('should classify string, number, boolean and date defaults', () => {
    expect(classifyDatabaseDefault("(N'guest')", 'string')).toEqual({
      kind: 'string',
      normalized: "N'guest'",
      value: 'guest',
    });

    expect(classifyDatabaseDefault('((42))', 'number')).toEqual({
      kind: 'number',
      normalized: '42',
      value: '42',
    });

    expect(classifyDatabaseDefault('((1))', 'boolean')).toEqual({
      kind: 'boolean',
      normalized: '1',
      value: true,
    });

    expect(classifyDatabaseDefault('(getdate())', 'date')).toEqual({
      kind: 'date_now',
      normalized: 'getdate()',
    });
  });

  it('should keep unsupported expressions as expressions', () => {
    expect(classifyDatabaseDefault('(newid())', 'string')).toEqual({
      kind: 'expression',
      normalized: 'newid()',
    });
  });

  it('should infer logical types from database data types', () => {
    expect(inferDefaultLogicalType('nvarchar')).toBe('string');
    expect(inferDefaultLogicalType('smallint')).toBe('number');
    expect(inferDefaultLogicalType('bit')).toBe('boolean');
    expect(inferDefaultLogicalType('datetime')).toBe('date');
    expect(inferDefaultLogicalType('binary')).toBe('other');
  });
});

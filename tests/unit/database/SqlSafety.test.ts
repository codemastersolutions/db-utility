import { describe, expect, it } from 'vitest';
import { assertSafeSql } from '../../../src/database/SqlSafety';

describe('assertSafeSql', () => {
  it('permite selects de metadados em information_schema', () => {
    const sql = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    expect(() => assertSafeSql(sql)).not.toThrow();
  });

  it('permite selects de metadados em sys', () => {
    const sql = `
      SELECT name
      FROM sys.tables
    `;

    expect(() => assertSafeSql(sql)).not.toThrow();
  });

  it('permite selects simples de verificação como SELECT 1', () => {
    expect(() => assertSafeSql('SELECT 1')).not.toThrow();
  });

  it('bloqueia comandos DML e DDL', () => {
    const queries = [
      'INSERT INTO users(id) VALUES (1)',
      'UPDATE users SET name = \'a\'',
      'DELETE FROM users',
      'DROP TABLE users',
      'TRUNCATE TABLE users',
      'ALTER TABLE users ADD COLUMN x INT',
      'CREATE TABLE users(id INT)',
    ];

    queries.forEach((sql) => {
      expect(() => assertSafeSql(sql)).toThrow();
    });
  });

  it('bloqueia selects em tabelas de dados', () => {
    const queries = [
      'SELECT * FROM users',
      'select id, name from customers',
    ];

    queries.forEach((sql) => {
      expect(() => assertSafeSql(sql)).toThrow();
    });
  });
});


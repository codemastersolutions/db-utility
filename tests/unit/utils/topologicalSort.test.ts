import { describe, expect, it } from 'vitest';
import { DatabaseSchema, TableMetadata } from '../../../src/types/introspection';
import { topologicalSort } from '../../../src/utils/topologicalSort';

describe('topologicalSort', () => {
  const createTable = (name: string, references: string[] = []): TableMetadata => ({
    name,
    columns: [],
    indexes: [],
    foreignKeys: references.map((ref) => ({
      name: `fk_${name}_${ref}`,
      tableName: name,
      columns: ['id'],
      referencedTable: ref,
      referencedColumns: ['id'],
    })),
  });

  it('deve ordenar tabelas independentes', () => {
    const schema: DatabaseSchema = {
      tables: [createTable('A'), createTable('B')],
    };

    const sorted = topologicalSort(schema);
    expect(sorted).toHaveLength(2);
    expect(sorted.map((t) => t.name).sort()).toEqual(['A', 'B']);
  });

  it('deve ordenar tabelas com dependências simples (B depende de A)', () => {
    // B -> A (B tem FK para A)
    // Ordem esperada: A, B
    const schema: DatabaseSchema = {
      tables: [createTable('B', ['A']), createTable('A')],
    };

    const sorted = topologicalSort(schema);
    const names = sorted.map((t) => t.name);
    
    expect(names.indexOf('A')).toBeLessThan(names.indexOf('B'));
  });

  it('deve lidar com cadeias de dependência (C -> B -> A)', () => {
    const schema: DatabaseSchema = {
      tables: [createTable('C', ['B']), createTable('A'), createTable('B', ['A'])],
    };

    const sorted = topologicalSort(schema);
    const names = sorted.map((t) => t.name);

    expect(names.indexOf('A')).toBeLessThan(names.indexOf('B'));
    expect(names.indexOf('B')).toBeLessThan(names.indexOf('C'));
  });

  it('deve lidar com dependências múltiplas (C -> A e B)', () => {
    const schema: DatabaseSchema = {
      tables: [createTable('C', ['A', 'B']), createTable('A'), createTable('B')],
    };

    const sorted = topologicalSort(schema);
    const names = sorted.map((t) => t.name);

    expect(names.indexOf('A')).toBeLessThan(names.indexOf('C'));
    expect(names.indexOf('B')).toBeLessThan(names.indexOf('C'));
  });

  it('deve lidar com dependências circulares sem travar (A -> B -> A)', () => {
    const schema: DatabaseSchema = {
      tables: [createTable('A', ['B']), createTable('B', ['A'])],
    };

    const sorted = topologicalSort(schema);
    expect(sorted).toHaveLength(2);
    // A ordem exata em ciclo é indefinida mas não deve explodir
  });
});

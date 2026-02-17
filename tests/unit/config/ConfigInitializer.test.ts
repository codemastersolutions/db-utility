import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { ConfigInitializer } from '../../../src/config/ConfigInitializer';

describe('ConfigInitializer', () => {
  const baseTempDir = mkdtempSync(join(tmpdir(), 'db-utility-config-init-test-'));

  afterAll(() => {
    rmSync(baseTempDir, { recursive: true, force: true });
  });

  it('deve criar arquivo de configuração quando não existe', () => {
    const runDir = mkdtempSync(join(baseTempDir, 'run-'));

    const result = ConfigInitializer.init(runDir, false);

    expect(result.created).toBe(true);
    expect(result.recreated).toBe(false);
    const content = readFileSync(join(runDir, 'dbutility.config.json'), 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;

    expect(parsed.language).toBe('pt-BR');
    expect(parsed.introspection).toBeUndefined();
    expect(parsed.migrations).toBeUndefined();
  });

  it('não deve recriar arquivo quando já existe e force = false', () => {
    const runDir = mkdtempSync(join(baseTempDir, 'run-no-force-'));

    ConfigInitializer.init(runDir, true);
    const initialContent = readFileSync(join(runDir, 'dbutility.config.json'), 'utf-8');

    const result = ConfigInitializer.init(runDir, false);

    const content = readFileSync(join(runDir, 'dbutility.config.json'), 'utf-8');

    expect(result.created).toBe(false);
    expect(result.recreated).toBe(false);
    expect(content).toBe(initialContent);
  });

  it('deve recriar arquivo quando force = true', () => {
    const runDir = mkdtempSync(join(baseTempDir, 'run-force-'));

    ConfigInitializer.init(runDir, true);
    const firstContent = readFileSync(join(runDir, 'dbutility.config.json'), 'utf-8');

    const result = ConfigInitializer.init(runDir, true);
    const secondContent = readFileSync(join(runDir, 'dbutility.config.json'), 'utf-8');

    expect(result.created).toBe(true);
    expect(result.recreated).toBe(true);
    expect(secondContent).toBe(firstContent);
  });
});

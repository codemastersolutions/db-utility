import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { resolveMigrationOutputDir } from '../../../src/cli/helpers';
import { AppConfig } from '../../../src/config/AppConfig';

describe('CLI Helpers - resolveMigrationOutputDir', () => {
  const cwd = '/test/cwd';
  const mockAppConfig: AppConfig = {
    language: 'en',
    introspection: { outputDir: 'intro' },
    migrations: { outputDir: 'config-migrations', fileNamePattern: 'timestamp-prefix' },
  };

  it('deve usar a opção da CLI se fornecida', () => {
    const result = resolveMigrationOutputDir(cwd, 'cli-migrations', mockAppConfig);
    expect(result).toBe('cli-migrations');
  });

  it('deve usar o outputDir do AppConfig se a opção da CLI não for fornecida', () => {
    const result = resolveMigrationOutputDir(cwd, undefined, mockAppConfig);
    expect(result).toBe(join(cwd, 'config-migrations'));
  });

  it('deve usar o fallback hardcoded se não houver CLI nem AppConfig migration dir', () => {
    // Simulando um AppConfig vazio ou sem migrations (embora o loader garanta defaults, é bom testar o fallback da função)
    const emptyConfig = { ...mockAppConfig, migrations: undefined } as unknown as AppConfig;
    const result = resolveMigrationOutputDir(cwd, undefined, emptyConfig);
    expect(result).toBe(join(cwd, 'exports', 'generated-migrations'));
  });
});

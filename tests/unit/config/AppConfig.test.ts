import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigLoader } from '../../../src/config/AppConfig';

vi.mock('node:fs');

describe('AppConfigLoader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('deve retornar configuração padrão quando nenhum arquivo ou env é encontrado', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const config = AppConfigLoader.load();

    expect(config.language).toBe('pt-BR');
    expect(config.introspection.outputDir).toBe('db-utility-introspect');
    expect(config.migrations.fileNamePattern).toBe('timestamp-prefix');
    expect(config.migrations.disableForeignKeys).toBe(false);
  });

  it('deve carregar idioma do arquivo de configuração json', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        language: 'en',
        introspection: {
          outputDir: 'custom-introspect',
        },
        migrations: {
          outputDir: 'custom-migrations',
          fileNamePattern: 'prefix-timestamp',
        },
      }),
    );

    const config = AppConfigLoader.load('db-utility.app.config.json');

    expect(config.language).toBe('en');
    expect(config.introspection.outputDir).toBe('custom-introspect');
    expect(config.migrations.outputDir).toBe('custom-migrations');
    expect(config.migrations.fileNamePattern).toBe('prefix-timestamp');
  });

  it('deve normalizar idioma vindo das variáveis de ambiente', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    process.env.DB_UTILITY_LANG = 'es-ES';

    const config = AppConfigLoader.load();

    expect(config.language).toBe('es');
  });

  it('deve carregar todas as configurações das variáveis de ambiente', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    process.env.DB_UTILITY_LANG = 'en';
    process.env.DB_UTILITY_INTROSPECTION_OUTPUT_DIR = 'env-introspect';
    process.env.DB_UTILITY_MIGRATIONS_OUTPUT_DIR = 'env-migrations';
    process.env.DB_UTILITY_MIGRATIONS_FILE_NAME_PATTERN = 'prefix-timestamp';
    process.env.DB_UTILITY_MIGRATIONS_DISABLE_FOREIGN_KEYS = 'true';

    const config = AppConfigLoader.load();

    expect(config.language).toBe('en');
    expect(config.introspection.outputDir).toBe('env-introspect');
    expect(config.migrations.outputDir).toBe('env-migrations');
    expect(config.migrations.fileNamePattern).toBe('prefix-timestamp');
    expect(config.migrations.disableForeignKeys).toBe(true);
  });

  it('deve priorizar arquivo de configuração sobre variáveis de ambiente e complementar opções ausentes', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        language: 'pt-BR',
        introspection: {
          outputDir: 'json-introspect',
        },
        migrations: {
          disableForeignKeys: true,
        },
      }),
    );

    process.env.DB_UTILITY_LANG = 'en';
    process.env.DB_UTILITY_INTROSPECTION_OUTPUT_DIR = 'env-introspect';
    process.env.DB_UTILITY_MIGRATIONS_OUTPUT_DIR = 'env-migrations';
    process.env.DB_UTILITY_MIGRATIONS_DISABLE_FOREIGN_KEYS = 'false';

    const config = AppConfigLoader.load('dbutility.config.json');

    expect(config.language).toBe('pt-BR');
    expect(config.introspection.outputDir).toBe('json-introspect');
    expect(config.migrations.outputDir).toBe('env-migrations');
    expect(config.migrations.disableForeignKeys).toBe(true);
  });
});

import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppConfigLoader,
  getMigrationConfigEntries,
  getPrimaryMigrationConfig,
} from '../../../src/config/AppConfig';

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
    const migrationConfig = getPrimaryMigrationConfig(config.migrations);

    expect(config.language).toBe('pt-BR');
    expect(config.introspection.outputDir).toBe('db-utility-introspect');
    expect(migrationConfig.fileNamePattern).toBe('timestamp-prefix');
    expect(migrationConfig.disableForeignKeys).toBe(false);
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
    const migrationConfig = getPrimaryMigrationConfig(config.migrations);

    expect(config.language).toBe('en');
    expect(config.introspection.outputDir).toBe('custom-introspect');
    expect(migrationConfig.outputDir).toBe('custom-migrations');
    expect(migrationConfig.fileNamePattern).toBe('prefix-timestamp');
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
    const migrationConfig = getPrimaryMigrationConfig(config.migrations);

    expect(config.language).toBe('en');
    expect(config.introspection.outputDir).toBe('env-introspect');
    expect(migrationConfig.outputDir).toBe('env-migrations');
    expect(migrationConfig.fileNamePattern).toBe('prefix-timestamp');
    expect(migrationConfig.disableForeignKeys).toBe(true);
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
    const migrationConfig = getPrimaryMigrationConfig(config.migrations);

    expect(config.language).toBe('pt-BR');
    expect(config.introspection.outputDir).toBe('json-introspect');
    expect(migrationConfig.outputDir).toBe('env-migrations');
    expect(migrationConfig.disableForeignKeys).toBe(true);
  });

  it('deve aceitar migrations como array e aplicar fallback do env em cada item', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        migrations: [
          {
            outputDir: 'migrations/a',
            connectionName: 'first-db',
            disableForeignKeys: true,
          },
          {
            outputDir: 'migrations/b',
            data: true,
            connectionName: 'second-db',
          },
        ],
      }),
    );

    process.env.DB_UTILITY_MIGRATIONS_FILE_NAME_PATTERN = 'prefix-timestamp';
    process.env.DB_UTILITY_MIGRATIONS_BACKUP = 'true';

    const config = AppConfigLoader.load('dbutility.config.json');
    const migrations = getMigrationConfigEntries(config.migrations);

    expect(Array.isArray(config.migrations)).toBe(true);
    expect(migrations).toHaveLength(2);
    expect(migrations[0]).toMatchObject({
      outputDir: 'migrations/a',
      connectionName: 'first-db',
      disableForeignKeys: true,
      fileNamePattern: 'prefix-timestamp',
      backup: true,
    });
    expect(migrations[1]).toMatchObject({
      outputDir: 'migrations/b',
      data: true,
      connectionName: 'second-db',
      fileNamePattern: 'prefix-timestamp',
      backup: true,
    });
  });
});

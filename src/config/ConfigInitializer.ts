import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AppLanguage } from './AppConfig';
import { DatabaseConfig } from '../types/database';

interface InitResult {
  created: boolean;
  path: string;
  recreated: boolean;
}

interface InitialFileConfig {
  language: AppLanguage;
  introspection: {
    outputDir: string;
  };
  migrations: {
    outputDir: string;
    fileNamePattern: 'timestamp-prefix' | 'prefix-timestamp';
  };
  connection?: Partial<DatabaseConfig>;
}

const defaultConfig: InitialFileConfig = {
  language: 'pt-BR',
  introspection: {
    outputDir: 'db-utility-introspect',
  },
  migrations: {
    outputDir: 'db-utility-migrations',
    fileNamePattern: 'timestamp-prefix',
  },
  connection: {
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: 'password',
    database: 'database_name',
    ssl: false,
  },
};

export class ConfigInitializer {
  static init(cwd: string, force = false): InitResult {
    const filePath = join(cwd, 'dbutility.config.json');
    const exists = existsSync(filePath);

    if (exists && !force) {
      return {
        created: false,
        path: filePath,
        recreated: false,
      };
    }

    const content = JSON.stringify(defaultConfig, null, 2);
    writeFileSync(filePath, `${content}\n`, 'utf-8');

    return {
      created: true,
      path: filePath,
      recreated: exists,
    };
  }
}

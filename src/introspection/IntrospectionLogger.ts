import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AppConfig } from '../config/AppConfig';
import { DatabaseConfig } from '../types/database';
import { DatabaseSchema } from '../types/introspection';

export class IntrospectionLogger {
  static logSchema(
    dbConfig: DatabaseConfig,
    schema: DatabaseSchema,
    baseDir: string,
    appConfig?: AppConfig,
  ): string {
    const rootDirName = appConfig ? appConfig.introspection.outputDir : 'db-utility-introspect';
    const rootDir = join(baseDir, rootDirName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dirName = `run-${timestamp}`;
    const runDir = join(rootDir, dirName);

    mkdirSync(runDir, { recursive: true });

    const schemaPath = join(runDir, 'schema.json');
    const metadataPath = join(runDir, 'metadata.json');

    const metadata = {
      type: dbConfig.type,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      executedAt: new Date().toISOString(),
      tablesCount: schema.tables.length,
    };

    writeFileSync(schemaPath, JSON.stringify(schema, null, 2), 'utf-8');
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    return runDir;
  }
}

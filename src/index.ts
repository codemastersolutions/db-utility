/**
 * DbUtility - The most powerful database utility.
 */
export { CryptoService } from './crypto/CryptoService';
export { ConfigLoader } from './config/ConfigLoader';
export { ConfigInitializer } from './config/ConfigInitializer';
export { AppConfigLoader } from './config/AppConfig';
export { ConnectionFactory } from './database/ConnectionFactory';
export { IntrospectionService } from './introspection/IntrospectionService';
export { SequelizeGenerator } from './generators/SequelizeGenerator';
export { TypeORMGenerator } from './generators/TypeORMGenerator';
export { PrismaGenerator } from './generators/PrismaGenerator';
export { MongooseGenerator } from './generators/MongooseGenerator';
export { DbUtilityError } from './errors/DbUtilityError';
export { MigrationTester } from './testing/MigrationTester';
export { ContainerManager } from './testing/ContainerManager';
export type {
  DatabaseConfig,
  DatabaseType,
  IDatabaseConnector,
  QueryOptions,
} from './types/database';
export type { DbUtilityErrorCode } from './errors/DbUtilityError';
export type {
  AppConfig,
  AppLanguage,
  AppMigrationsConfig,
  MigrationConfig,
  MigrationTestDatabaseConfig,
  MigrationTestDatabaseImageConfig,
  DataTableConfig,
} from './config/AppConfig';

export const hello = () => {
  return 'Hello from DbUtility';
};

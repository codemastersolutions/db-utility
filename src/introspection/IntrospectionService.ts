import { ConnectionFactory } from '../database/ConnectionFactory';
import { DatabaseConfig, IDatabaseConnector } from '../types/database';
import { DatabaseSchema } from '../types/introspection';
import { DbUtilityError } from '../errors/DbUtilityError';
import { IDatabaseIntrospector } from './Introspector';
import { PostgresIntrospector } from './PostgresIntrospector';
import { MysqlIntrospector } from './MysqlIntrospector';
import { MssqlIntrospector } from './MssqlIntrospector';

export class IntrospectionService {
  private connector: IDatabaseConnector;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    if (!config.type) {
      throw new DbUtilityError('INTROSPECTION_DB_TYPE_REQUIRED');
    }

    this.config = config;
    this.connector = ConnectionFactory.create(config);
  }

  async introspect(): Promise<DatabaseSchema> {
    await this.connector.connect();

    try {
      const introspector = this.createIntrospector();
      const schema = await introspector.introspectSchema();
      return schema;
    } finally {
      await this.connector.disconnect();
    }
  }

  private createIntrospector(): IDatabaseIntrospector {
    switch (this.config.type) {
      case 'postgres':
        return new PostgresIntrospector(this.connector);
      case 'mysql':
        return new MysqlIntrospector(this.connector);
      case 'mssql':
        return new MssqlIntrospector(this.connector);
      default:
        throw new DbUtilityError('INTROSPECTION_DB_TYPE_UNSUPPORTED');
    }
  }
}

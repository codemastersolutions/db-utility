import { DbUtilityError } from '../errors/DbUtilityError';
import { DatabaseConfig, IDatabaseConnector } from '../types/database';
import { DatabaseSchema } from '../types/introspection';
import { IDatabaseIntrospector } from './Introspector';
import { MssqlIntrospector } from './MssqlIntrospector';
import { MysqlIntrospector } from './MysqlIntrospector';
import { PostgresIntrospector } from './PostgresIntrospector';

export class IntrospectionService {
  private connector: IDatabaseConnector;
  private config: DatabaseConfig;

  constructor(connector: IDatabaseConnector, config: DatabaseConfig) {
    if (!config.type) {
      throw new DbUtilityError('INTROSPECTION_DB_TYPE_REQUIRED');
    }

    this.config = config;
    this.connector = connector;
  }

  async introspect(): Promise<DatabaseSchema> {
    const introspector = this.createIntrospector();
    const schema = await introspector.introspectSchema();
    return schema;
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

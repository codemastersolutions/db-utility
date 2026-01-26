import { DatabaseConfig, IDatabaseConnector } from '../types/database';
import { MysqlConnector } from './connectors/MysqlConnector';
import { PostgresConnector } from './connectors/PostgresConnector';
import { MssqlConnector } from './connectors/MssqlConnector';

export class ConnectionFactory {
  static create(config: DatabaseConfig): IDatabaseConnector {
    switch (config.type) {
      case 'mysql':
        return new MysqlConnector(config);
      case 'postgres':
        return new PostgresConnector(config);
      case 'mssql':
        return new MssqlConnector(config);
      default:
        throw new Error(`Tipo de banco de dados não suportado: ${config.type}`);
    }
  }
}

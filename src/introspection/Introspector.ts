import { DatabaseSchema } from '../types/introspection';
import { IDatabaseConnector } from '../types/database';

export interface IDatabaseIntrospector {
  introspectSchema(): Promise<DatabaseSchema>;
}

export abstract class BaseIntrospector implements IDatabaseIntrospector {
  protected connector: IDatabaseConnector;

  constructor(connector: IDatabaseConnector) {
    this.connector = connector;
  }

  abstract introspectSchema(): Promise<DatabaseSchema>;
}

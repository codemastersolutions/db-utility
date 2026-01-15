export type DbUtilityErrorCode =
  | 'INTROSPECTION_DB_TYPE_REQUIRED'
  | 'INTROSPECTION_DB_TYPE_UNSUPPORTED'
  | 'APP_CONFIG_FILE_NOT_FOUND'
  | 'APP_CONFIG_FILE_FORMAT_UNSUPPORTED'
  | 'CONFIG_FILE_NOT_FOUND'
  | 'CONFIG_FILE_FORMAT_UNSUPPORTED'
  | 'CONFIG_DB_TYPE_OR_CONNECTION_STRING_REQUIRED'
  | 'CONFIG_DB_TYPE_REQUIRED'
  | 'CONNECTION_FAILED';

export class DbUtilityError extends Error {
  code: DbUtilityErrorCode;
  details?: string;

  constructor(code: DbUtilityErrorCode, details?: string) {
    super(code);
    this.name = 'DbUtilityError';
    this.code = code;
    this.details = details;
  }
}

export type DbUtilityErrorCode =
  | 'INTROSPECTION_DB_TYPE_REQUIRED'
  | 'INTROSPECTION_DB_TYPE_UNSUPPORTED'
  | 'APP_CONFIG_FILE_NOT_FOUND'
  | 'APP_CONFIG_FILE_FORMAT_UNSUPPORTED'
  | 'CONFIG_FILE_NOT_FOUND'
  | 'CONFIG_FILE_FORMAT_UNSUPPORTED'
  | 'CONFIG_DB_TYPE_OR_CONNECTION_STRING_REQUIRED'
  | 'CONFIG_DB_TYPE_REQUIRED'
  | 'CONFIG_DB_CONNECT_TIMEOUT_INVALID'
  | 'CONNECTION_FAILED'
  | 'CONNECTION_CONFIG_NOT_FOUND'
  | 'CRYPTO_KEY_REQUIRED'
  | 'CRYPTO_INVALID_INPUT'
  | 'CRYPTO_DECRYPT_FAILED'
  | 'CONFIG_ENCRYPTED_FIELDS_INVALID';

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

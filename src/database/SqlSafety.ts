export type DbUtilitySecurityErrorCode = 'UNSAFE_OPERATION' | 'UNSAFE_DATA_SELECT';

export class DbUtilitySecurityError extends Error {
  code: DbUtilitySecurityErrorCode;

  constructor(code: DbUtilitySecurityErrorCode) {
    super(code);
    this.name = 'DbUtilitySecurityError';
    this.code = code;
  }
}

export function assertSafeSql(sql: string): void {
  const normalized = sql.toLowerCase();

  const forbiddenKeywords = [
    'insert',
    'update',
    'delete',
    'merge',
    'drop',
    'truncate',
    'alter',
    'create',
    'grant',
    'revoke',
    'execute',
    'exec',
    'call',
  ];

  for (const keyword of forbiddenKeywords) {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(sql)) {
      throw new DbUtilitySecurityError('UNSAFE_OPERATION');
    }
  }

  if (normalized.includes('select')) {
    const isMetadataSelect =
      normalized.includes('information_schema.') ||
      normalized.includes(' from pg_catalog ') ||
      normalized.includes(' from sys.') ||
      /\bselect\s+1\b/.test(normalized);

    if (!isMetadataSelect) {
      throw new DbUtilitySecurityError('UNSAFE_DATA_SELECT');
    }
  }
}

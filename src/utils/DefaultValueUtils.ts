export type DefaultLogicalType = 'string' | 'number' | 'boolean' | 'date' | 'other';

export type ClassifiedDefaultValue =
  | { kind: 'empty'; normalized: string }
  | { kind: 'string'; normalized: string; value: string }
  | { kind: 'number'; normalized: string; value: string }
  | { kind: 'boolean'; normalized: string; value: boolean }
  | { kind: 'date_now'; normalized: string }
  | { kind: 'unsupported'; normalized: string }
  | { kind: 'expression'; normalized: string };

export function normalizeDatabaseDefault(defaultValue: string): string {
  const extractedDefault = extractLegacyCreateDefaultExpression(defaultValue.trim());
  return unwrapOuterParentheses(extractedDefault);
}

export function classifyDatabaseDefault(
  defaultValue: string,
  logicalType: DefaultLogicalType,
): ClassifiedDefaultValue {
  const normalized = normalizeDatabaseDefault(defaultValue);
  const lowerDefault = normalized.toLowerCase();

  if (normalized === '') {
    return { kind: 'empty', normalized };
  }

  if (/^n?'(?:[^']|'')*'$/i.test(normalized)) {
    return {
      kind: 'string',
      normalized,
      value:
        normalized.startsWith("N'") || normalized.startsWith("n'")
          ? normalized.slice(2, -1).replaceAll("''", "'")
          : normalized.slice(1, -1).replaceAll("''", "'"),
    };
  }

  if (/^[+-]?\d+(\.\d+)?$/.test(normalized)) {
    if (logicalType === 'date') {
      return { kind: 'unsupported', normalized };
    }

    if (logicalType === 'boolean') {
      return { kind: 'boolean', normalized, value: normalized !== '0' };
    }

    return { kind: 'number', normalized, value: normalized };
  }

  if (/^(true|false)$/i.test(normalized)) {
    return { kind: 'boolean', normalized, value: lowerDefault === 'true' };
  }

  if (
    logicalType === 'date' &&
    ['now()', 'current_timestamp', 'getdate()', 'sysdatetime()', 'getutcdate()'].includes(
      lowerDefault,
    )
  ) {
    return { kind: 'date_now', normalized };
  }

  return { kind: 'expression', normalized };
}

export function inferDefaultLogicalType(dataType: string): DefaultLogicalType {
  const lowerDataType = dataType.toLowerCase();

  if (lowerDataType === 'bit' || lowerDataType.includes('bool')) return 'boolean';
  if (lowerDataType.includes('date') || lowerDataType.includes('time')) return 'date';
  if (
    lowerDataType.includes('int') ||
    lowerDataType.includes('float') ||
    lowerDataType.includes('double') ||
    lowerDataType.includes('decimal') ||
    lowerDataType.includes('numeric') ||
    lowerDataType.includes('money')
  ) {
    return 'number';
  }
  if (
    lowerDataType.includes('char') ||
    lowerDataType.includes('text') ||
    lowerDataType.includes('ntext') ||
    lowerDataType.includes('xml') ||
    lowerDataType.includes('uuid') ||
    lowerDataType.includes('guid')
  ) {
    return 'string';
  }

  return 'other';
}

function extractLegacyCreateDefaultExpression(defaultValue: string): string {
  const match = /^CREATE\s+DEFAULT\s+\S+\s+AS\s+([\s\S]+?)(?:\s+FOR\s+[\s\S]+)?$/i.exec(
    defaultValue,
  );

  return match ? match[1].trim() : defaultValue;
}

function unwrapOuterParentheses(value: string): string {
  let normalized = value;

  while (hasWrappedOuterParentheses(normalized)) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
}

function hasWrappedOuterParentheses(value: string): boolean {
  if (value.length < 2 || !value.startsWith('(') || !value.endsWith(')')) {
    return false;
  }

  let depth = 0;
  let inString = false;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    const next = value[index + 1];

    if (char === "'") {
      if (inString && next === "'") {
        index++;
        continue;
      }

      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;

      if (depth === 0 && index < value.length - 1) {
        return false;
      }
    }
  }

  return depth === 0 && !inString;
}

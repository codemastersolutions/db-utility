import { AliasTypeMetadata, ColumnMetadata, DatabaseSchema } from '../types/introspection';
import { inferDefaultLogicalType } from './DefaultValueUtils';

export function getEffectiveDataType(column: ColumnMetadata): string {
  return column.primitiveDataType ?? column.dataType;
}

export function inferEffectiveDefaultLogicalType(column: ColumnMetadata) {
  return inferDefaultLogicalType(getEffectiveDataType(column));
}

export function getUsedAliasTypes(schema: DatabaseSchema): AliasTypeMetadata[] {
  if (!schema.aliasTypes || schema.aliasTypes.length === 0) {
    return [];
  }

  const usedAliasKeys = new Set(
    schema.tables.flatMap((table) =>
      table.columns
        .filter((column) => column.aliasTypeName)
        .map((column) => buildAliasKey(column.aliasTypeSchema ?? 'dbo', column.aliasTypeName ?? '')),
    ),
  );

  return schema.aliasTypes
    .filter((aliasType) => usedAliasKeys.has(buildAliasKey(aliasType.schemaName, aliasType.name)))
    .sort((left, right) =>
      `${left.schemaName}.${left.name}`.localeCompare(`${right.schemaName}.${right.name}`),
    );
}

export function formatMssqlQualifiedName(schemaName: string, name: string): string {
  return `[${escapeSqlIdentifier(schemaName)}].[${escapeSqlIdentifier(name)}]`;
}

export function formatMssqlTypeReference(aliasType: AliasTypeMetadata): string {
  const lower = aliasType.baseDataType.toLowerCase();

  if (usesLength(lower)) {
    if (aliasType.maxLength === -1) {
      return `${aliasType.baseDataType}(MAX)`;
    }

    if (aliasType.maxLength && aliasType.maxLength > 0) {
      return `${aliasType.baseDataType}(${aliasType.maxLength})`;
    }
  }

  if (usesPrecisionAndScale(lower)) {
    if (
      aliasType.numericPrecision !== null &&
      aliasType.numericPrecision !== undefined &&
      aliasType.numericScale !== null &&
      aliasType.numericScale !== undefined
    ) {
      return `${aliasType.baseDataType}(${aliasType.numericPrecision}, ${aliasType.numericScale})`;
    }

    if (aliasType.numericPrecision !== null && aliasType.numericPrecision !== undefined) {
      return `${aliasType.baseDataType}(${aliasType.numericPrecision})`;
    }
  }

  if (usesScale(lower) && aliasType.numericScale !== null && aliasType.numericScale !== undefined) {
    return `${aliasType.baseDataType}(${aliasType.numericScale})`;
  }

  if (lower === 'float' && aliasType.numericPrecision) {
    return `${aliasType.baseDataType}(${aliasType.numericPrecision})`;
  }

  return aliasType.baseDataType;
}

function buildAliasKey(schemaName: string, name: string): string {
  return `${schemaName}.${name}`.toLowerCase();
}

function escapeSqlIdentifier(value: string): string {
  return value.replaceAll(']', ']]');
}

function usesLength(dataType: string): boolean {
  return new Set(['char', 'varchar', 'nchar', 'nvarchar', 'binary', 'varbinary']).has(dataType);
}

function usesPrecisionAndScale(dataType: string): boolean {
  return new Set(['decimal', 'numeric']).has(dataType);
}

function usesScale(dataType: string): boolean {
  return new Set(['time', 'datetime2', 'datetimeoffset']).has(dataType);
}

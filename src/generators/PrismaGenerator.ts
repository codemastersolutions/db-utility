import { ColumnMetadata, DatabaseSchema } from '../types/introspection';
import { classifyDatabaseDefault, inferDefaultLogicalType } from '../utils/DefaultValueUtils';
import { getGeneratableIndexes } from '../utils/IndexUtils';
import { GeneratedFile, SchemaGenerator } from './GeneratorTypes';

export class PrismaGenerator implements SchemaGenerator {
  async generate(schema: DatabaseSchema): Promise<GeneratedFile[]> {
    const lines: string[] = [];

    // Header
    lines.push('generator client {');
    lines.push('  provider = "prisma-client-js"');
    lines.push('}');
    lines.push('');
    lines.push('datasource db {');
    lines.push('  provider = "postgresql" // Default, change as needed');
    lines.push('  url      = env("DATABASE_URL")');
    lines.push('}');
    lines.push('');

    for (const table of schema.tables) {
      const indexes = getGeneratableIndexes(table.indexes);
      lines.push(`model ${this.formatModelName(table.name)} {`);

      for (const col of table.columns) {
        const type = this.mapType(col.dataType);
        const modifiers = this.getModifiers(col);
        lines.push(`  ${col.name} ${type}${modifiers}`);
      }

      // Add relations if any (simplification: just basic field mapping)
      // Note: Real Prisma generation requires comprehensive relation mapping which is complex.
      // We will focus on fields and basic constraints first.

      // Add indexes and constraints with names
      for (const idx of indexes) {
        const cols = idx.columns.join(', ');
        if (idx.isPrimary) {
          lines.push(`  @@id([${cols}], map: "${idx.name}")`);
        } else if (idx.isUnique) {
          lines.push(`  @@unique([${cols}], map: "${idx.name}")`);
        } else {
          lines.push(`  @@index([${cols}], map: "${idx.name}")`);
        }
      }

      lines.push('');
      lines.push(`  @@map("${table.name}")`);
      lines.push('}');
      lines.push('');
    }

    return [
      {
        fileName: 'schema.prisma',
        content: lines.join('\n'),
      },
    ];
  }

  private formatModelName(name: string): string {
    // PascalCase
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  private mapType(dataType: string): string {
    const lower = dataType.toLowerCase();
    if (lower.includes('int')) return 'Int';
    if (lower.includes('char') || lower.includes('text')) return 'String';
    if (lower.includes('bool')) return 'Boolean';
    if (lower.includes('date') || lower.includes('time')) return 'DateTime';
    if (lower.includes('float') || lower.includes('double') || lower.includes('decimal'))
      return 'Float'; // Decimal is better but Float for simplicity
    return 'String'; // Fallback
  }

  private getModifiers(col: ColumnMetadata): string {
    let mods = '';

    // We handle @id in @@id block to support custom names
    // But we still need autoincrement on the field if applicable
    if (col.isPrimaryKey && col.isAutoIncrement) {
      mods += ' @default(autoincrement())';
    }

    if (!col.isPrimaryKey) {
      if (col.isNullable) {
        mods += '?';
      } else {
        // Prisma fields are required by default, optional with ?
      }
    }

    // We handle @unique in @@unique block to support custom names
    // if (col.isUnique) {
    //   mods += ' @unique';
    // }

    // Default values
    if (col.hasDefault && col.defaultValue !== null) {
      const defaultModifier = this.formatPrismaDefaultValue(col);
      if (defaultModifier) {
        mods += ` ${defaultModifier}`;
      }
    }

    return mods;
  }

  private formatPrismaDefaultValue(col: ColumnMetadata): string | null {
    const classification = classifyDatabaseDefault(
      col.defaultValue ?? '',
      inferDefaultLogicalType(col.dataType),
    );

    switch (classification.kind) {
      case 'empty':
        return '@default("")';
      case 'string':
        return `@default(${JSON.stringify(classification.value)})`;
      case 'number':
        return `@default(${classification.value})`;
      case 'boolean':
        return `@default(${classification.value ? 'true' : 'false'})`;
      case 'date_now':
        return '@default(now())';
      case 'expression':
        return null;
    }
  }

}

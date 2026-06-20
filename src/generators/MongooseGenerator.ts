import {
  ColumnMetadata,
  DatabaseSchema,
} from '../types/introspection';
import { classifyDatabaseDefault, inferDefaultLogicalType } from '../utils/DefaultValueUtils';
import { getGeneratableIndexes } from '../utils/IndexUtils';
import { GeneratedFile, SchemaGenerator } from './GeneratorTypes';

export class MongooseGenerator implements SchemaGenerator {
  async generate(schema: DatabaseSchema): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    for (const table of schema.tables) {
      const className = this.formatModelName(table.name);
      const indexes = getGeneratableIndexes(table.indexes);
      const content = `import { Schema, model, Document } from 'mongoose';

export interface I${className} extends Document {
${table.columns.map((c) => `  ${c.name}: ${this.getTsType(c.dataType)};`).join('\n')}
}

const ${className}Schema = new Schema<I${className}>({
${table.columns.map((c) => this.generateFieldDefinition(c)).join(',\n')}
}, {
  timestamps: true,
  collection: '${table.name}'
});

${indexes
  .filter((idx) => !idx.isPrimary) // Mongoose handles _id, but if we have other PKs from SQL, we index them as unique.
  .map(
    (idx) =>
      `${className}Schema.index({ ${idx.columns
        .map((c) => `${c}: 1`)
        .join(', ')} }, { name: '${idx.name}', unique: ${idx.isUnique} });`,
  )
  .join('\n')}

export const ${className} = model<I${className}>('${className}', ${className}Schema);
`;
      files.push({
        fileName: `${className}.ts`,
        content,
      });
    }

    return files;
  }

  private formatModelName(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  private getTsType(dataType: string): string {
    const lower = dataType.toLowerCase();
    if (lower.includes('int') || lower.includes('float') || lower.includes('decimal')) return 'number';
    if (lower.includes('bool')) return 'boolean';
    if (lower.includes('date') || lower.includes('time')) return 'Date';
    return 'string';
  }

  private generateFieldDefinition(col: ColumnMetadata): string {
    const type = this.getMongooseType(col.dataType);
    const parts = [`    type: ${type}`];

    if (!col.isNullable) parts.push('    required: true');
    // Unique is handled by schema.index to preserve names
    // if (col.isUnique) parts.push('    unique: true');

    if (col.hasDefault && col.defaultValue !== null && col.defaultValue !== undefined) {
      const defaultValue = this.formatMongooseDefaultValue(col);
      if (defaultValue !== null) {
        parts.push(`    default: ${defaultValue}`);
      }
    }

    return `  ${col.name}: {\n${parts.join(',\n')}\n  }`;
  }

  private getMongooseType(dataType: string): string {
    const lower = dataType.toLowerCase();
    if (lower.includes('int') || lower.includes('float') || lower.includes('decimal')) return 'Number';
    if (lower.includes('bool')) return 'Boolean';
    if (lower.includes('date') || lower.includes('time')) return 'Date';
    return 'String';
  }

  private formatMongooseDefaultValue(col: ColumnMetadata): string | null {
    const classification = classifyDatabaseDefault(
      col.defaultValue ?? '',
      inferDefaultLogicalType(col.dataType),
    );

    switch (classification.kind) {
      case 'empty':
        return '""';
      case 'string':
        return JSON.stringify(classification.value);
      case 'number':
        return classification.value;
      case 'boolean':
        return classification.value ? 'true' : 'false';
      case 'date_now':
        return 'Date.now';
      case 'unsupported':
        return null;
      case 'expression':
        return null;
    }
  }

}

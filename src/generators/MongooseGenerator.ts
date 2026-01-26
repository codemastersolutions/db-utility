import { ColumnMetadata, DatabaseSchema } from '../types/introspection';
import { GeneratedFile, SchemaGenerator } from './GeneratorTypes';

export class MongooseGenerator implements SchemaGenerator {
  async generate(schema: DatabaseSchema): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    for (const table of schema.tables) {
      const className = this.formatModelName(table.name);
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

${table.indexes
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
    if (lower.includes('int') || lower.includes('float') || lower.includes('decimal'))
      return 'number';
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

    if (col.hasDefault && col.defaultValue) {
      // Simple default handling
      if (!col.defaultValue.includes('(')) {
        // Avoid function calls like now()
        parts.push(`    default: ${JSON.stringify(col.defaultValue)}`);
      }
    }

    return `  ${col.name}: {\n${parts.join(',\n')}\n  }`;
  }

  private getMongooseType(dataType: string): string {
    const lower = dataType.toLowerCase();
    if (lower.includes('int') || lower.includes('float') || lower.includes('decimal'))
      return 'Number';
    if (lower.includes('bool')) return 'Boolean';
    if (lower.includes('date') || lower.includes('time')) return 'Date';
    return 'String';
  }
}

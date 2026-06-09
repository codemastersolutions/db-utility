import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GeneratedFile } from './GeneratorTypes';

export class GeneratorWriter {
  static clean(outputDir: string) {
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true });
      console.log(`Cleaned output directory: ${outputDir}`);
    }
  }

  static write(files: GeneratedFile[], outputDir: string) {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    for (const file of files) {
      const path = join(outputDir, file.fileName);
      writeFileSync(path, file.content, 'utf-8');
      console.log(`Created: ${path}`);
    }
  }
}

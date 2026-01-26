import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeneratorWriter } from '../../../src/generators/GeneratorWriter';
import * as fs from 'fs';
import { join } from 'path';
import { GeneratedFile } from '../../../src/generators/GeneratorTypes';

vi.mock('fs');

describe('GeneratorWriter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should clean directory if it exists', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    // rmSync might be mocked automatically by vi.mock('fs'), but spyOn ensures we can check it

    GeneratorWriter.clean('/tmp/test');

    expect(fs.existsSync).toHaveBeenCalledWith('/tmp/test');
    expect(fs.rmSync).toHaveBeenCalledWith('/tmp/test', { recursive: true, force: true });
  });

  it('should not clean directory if it does not exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    GeneratorWriter.clean('/tmp/test');

    expect(fs.existsSync).toHaveBeenCalledWith('/tmp/test');
    expect(fs.rmSync).not.toHaveBeenCalled();
  });

  it('should write files', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const files: GeneratedFile[] = [{ fileName: 'test.ts', content: 'content' }];
    const outputDir = '/tmp/test';

    GeneratorWriter.write(files, outputDir);

    expect(fs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(join(outputDir, 'test.ts'), 'content', 'utf-8');
  });
});

import { join } from 'node:path';
import { AppConfig } from '../config/AppConfig';

export const resolveMigrationOutputDir = (
  cwd: string,
  cliOutputOption: string | undefined,
  appConfig: AppConfig,
): string => {
  if (cliOutputOption) {
    return cliOutputOption;
  }

  if (appConfig.migrations?.outputDir) {
    return join(cwd, appConfig.migrations.outputDir);
  }

  return join(cwd, 'exports', 'migrations');
};

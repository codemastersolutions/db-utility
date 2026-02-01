import { join } from 'path';
import { AppConfig } from '../config/AppConfig';

export const resolveMigrationOutputDir = (
  cwd: string,
  cliOutputOption: string | undefined,
  appConfig: AppConfig,
): string => {
  if (cliOutputOption) {
    return cliOutputOption;
  }

  if (appConfig.migrations && appConfig.migrations.outputDir) {
    return join(cwd, appConfig.migrations.outputDir);
  }

  return join(cwd, 'exports', 'generated-migrations');
};

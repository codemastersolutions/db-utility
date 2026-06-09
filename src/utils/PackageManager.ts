import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export type InstallScope = 'global' | 'dependencies' | 'devDependencies';

export class PackageManager {
  private async detectPm(): Promise<'pnpm' | 'npm'> {
    try {
      await execAsync('pnpm --version');
      return 'pnpm';
    } catch {
      return 'npm';
    }
  }

  /**
   * Checks if a package is installed.
   * For global, checks `npm list -g`.
   * For local, checks `require.resolve`.
   */
  async isInstalled(packageName: string, scope: 'global' | 'local' = 'local'): Promise<boolean> {
    if (scope === 'global') {
      const pm = await this.detectPm();
      const command =
        pm === 'pnpm'
          ? `pnpm ls -g ${packageName} --depth=0`
          : `npm list -g ${packageName} --depth=0`;
      try {
        await execAsync(command);
        return true;
      } catch {
        return false;
      }
    } else {
      try {
        // Try to resolve from current working directory
        const cwd = process.cwd();
        require.resolve(packageName, { paths: [cwd] });
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Gets the installed version of a package.
   */
  async getInstalledVersion(
    packageName: string,
    scope: 'global' | 'local' = 'local',
  ): Promise<string | null> {
    if (scope === 'global') {
      const pm = await this.detectPm();
      const command =
        pm === 'pnpm'
          ? `pnpm ls -g ${packageName} --depth=0 --json`
          : `npm list -g ${packageName} --depth=0 --json`;
      try {
        const { stdout } = await execAsync(command);
        const result = JSON.parse(stdout);
        return result.dependencies?.[packageName]?.version || result.version || null;
      } catch {
        return null;
      }
    } else {
      try {
        // Try to require package.json from the package
        const cwd = process.cwd();
        const packagePath = require.resolve(`${packageName}/package.json`, { paths: [cwd] });
        const pkg = require(packagePath);
        return pkg.version;
      } catch {
        // Fallback to npm list
        try {
          const pm = await this.detectPm();
          const command =
            pm === 'pnpm'
              ? `pnpm ls ${packageName} --depth=0 --json`
              : `npm list ${packageName} --depth=0 --json`;
          const { stdout } = await execAsync(command);
          const result = JSON.parse(stdout);
          return result.dependencies?.[packageName]?.version || null;
        } catch {
          return null;
        }
      }
    }
  }

  /**
   * Installs a package.
   */
  async install(
    packageName: string,
    options: { scope: InstallScope; version?: string },
  ): Promise<void> {
    const { scope, version } = options;
    const pkgWithVersion = version ? `${packageName}@${version}` : packageName;

    const pm = await this.detectPm();
    let command: string;
    if (pm === 'pnpm') {
      if (scope === 'global') command = `pnpm add -g ${pkgWithVersion}`;
      else if (scope === 'devDependencies') command = `pnpm add -D ${pkgWithVersion}`;
      else command = `pnpm add ${pkgWithVersion}`;
    } else {
      command = 'npm install';
      if (scope === 'global') {
        command += ` -g ${pkgWithVersion}`;
      } else if (scope === 'devDependencies') {
        command += ` --save-dev ${pkgWithVersion}`;
      } else {
        command += ` --save ${pkgWithVersion}`;
      }
    }

    console.log(`Installing ${pkgWithVersion} (${scope})...`);
    await execAsync(command);
    console.log(`Installed ${pkgWithVersion}.`);
  }

  /**
   * Uninstalls a package.
   */
  async uninstall(packageName: string, scope: InstallScope | 'local'): Promise<void> {
    const pm = await this.detectPm();
    let command: string;
    if (pm === 'pnpm') {
      if (scope === 'global') command = `pnpm remove -g ${packageName}`;
      else command = `pnpm remove ${packageName}`;
    } else {
      command = 'npm uninstall';
      if (scope === 'global') {
        command += ` -g ${packageName}`;
      } else {
        command += ` ${packageName}`;
      }
    }

    console.log(`Uninstalling ${packageName}...`);
    await execAsync(command);
    console.log(`Uninstalled ${packageName}.`);
  }

  async getGlobalInstallPath(): Promise<string> {
    const pm = await this.detectPm();
    const { stdout } = await execAsync(pm === 'pnpm' ? 'pnpm root -g' : 'npm root -g');
    return stdout.trim();
  }

  /**
   * Resolves the latest version matching the input.
   * "6" -> latest 6.x.x
   * "6.1" -> latest 6.1.x
   * "6.1.5" -> 6.1.5
   */
  async resolveVersion(packageName: string, versionInput: string): Promise<string | null> {
    try {
      // Use npm view to find versions
      const pm = await this.detectPm();
      const { stdout } = await execAsync(`${pm} view ${packageName} versions --json`);
      const versions: string[] = JSON.parse(stdout);

      // Filter versions starting with versionInput
      // e.g. "6" should match "6.0.0", "6.1.0", etc.
      // But "6" usually means ^6.0.0 or just 6.x.x.
      // The user requirement: "Major: 6 - ultima versão 6.x.x", "Minor: 6.1 - ultima versão 6.1.x", "Patch: 6.1.5 - versão 6.1.5"

      // We can use semver satisfying logic, or simple string matching for this specific requirement.
      // Let's implement the specific requirement.

      const validVersions = versions.filter(
        (v) => v.startsWith(versionInput + '.') || v === versionInput,
      );

      if (validVersions.length === 0) {
        // Maybe the user input "6" matches "6.0.0" exactly?
        // Or if input is "6", we look for "6.*".
        // Let's try to find the max satisfying version.
        return null;
      }

      // Sort and pick latest
      // Simple string sort might not be enough for semver (10.0.0 < 2.0.0 in string), but usually npm returns sorted or we can use semver sort.
      // Since we don't have 'semver' package in dependencies, let's try to rely on npm view with explicit version if possible,
      // or just assume the list from npm view is sorted or sort it ourselves.
      // npm view versions returns all versions.

      // Better approach: use `npm view packageName@versionInput version`
      // If versionInput is "6", npm resolves it to latest 6.x.x.
      // If versionInput is "6.1", npm resolves it to latest 6.1.x.
      // If versionInput is "6.1.5", it resolves to 6.1.5.

      try {
        const { stdout: resolvedVersion } = await execAsync(
          `${pm} view ${packageName}@${versionInput} version`,
        );
        return resolvedVersion.trim();
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }
}

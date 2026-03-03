import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import https from 'https';
import inquirer from 'inquirer';
import { homedir } from 'os';
import { join } from 'path';
import { VersionCheckConfig } from '../config/AppConfig';

interface LastCheckInfo {
  lastChecked: number;
}

export class VersionChecker {
  private config: VersionCheckConfig;
  private currentVersion: string;
  private pkgName = '@codemastersolutions/db-utility';
  private storageDir: string;
  private storagePath: string;

  constructor(currentVersion: string, config?: VersionCheckConfig) {
    this.currentVersion = currentVersion;
    this.config = config || { enabled: true, frequency: 'daily' };
    this.storageDir = join(homedir(), '.db-utility');
    this.storagePath = join(this.storageDir, 'version-check.json');
  }

  async check(): Promise<boolean> {
    if (!this.config.enabled) return true;

    if (!this.shouldCheck()) return true;

    const hasInternet = await this.hasInternetConnection();
    if (!hasInternet) return true;

    try {
      const latestVersion = await this.getLatestVersion();
      this.updateLastCheck();

      if (this.compareVersions(latestVersion, this.currentVersion) > 0) {
        const updated = await this.promptAndUpdate(latestVersion);
        return !updated;
      }
    } catch (error) {
      // Silent fail to not interrupt user flow
    }
    return true;
  }

  private shouldCheck(): boolean {
    if (!existsSync(this.storagePath)) return true;

    try {
      const content = readFileSync(this.storagePath, 'utf-8');
      const info: LastCheckInfo = JSON.parse(content);
      const lastChecked = new Date(info.lastChecked);
      const now = new Date();

      const diffTime = Math.abs(now.getTime() - lastChecked.getTime());
      const oneDay = 1000 * 60 * 60 * 24;

      switch (this.config.frequency) {
        case 'daily':
          return diffTime >= oneDay;
        case 'weekly':
          return diffTime >= oneDay * 7;
        case 'monthly':
          return diffTime >= oneDay * 30;
        default:
          return diffTime >= oneDay;
      }
    } catch {
      return true;
    }
  }

  private updateLastCheck(): void {
    try {
      if (!existsSync(this.storageDir)) {
        mkdirSync(this.storageDir, { recursive: true });
      }
      const info: LastCheckInfo = { lastChecked: Date.now() };
      writeFileSync(this.storagePath, JSON.stringify(info));
    } catch {
      // Ignore write errors
    }
  }

  private hasInternetConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = https.get('https://registry.npmjs.org', { timeout: 10000 }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private getLatestVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      https
        .get(`https://registry.npmjs.org/${this.pkgName}/latest`, { timeout: 10000 }, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve(json.version);
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
  }

  private compareVersions(v1: string, v2: string): number {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }

  private async promptAndUpdate(latestVersion: string): Promise<boolean> {
    console.log(`\nNew version available: ${latestVersion} (current: ${this.currentVersion})`);

    const { shouldUpdate } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldUpdate',
        message: 'Do you want to update to the latest version?',
        default: true,
      },
    ]);

    if (shouldUpdate) {
      await this.performUpdate();
      return true;
    }

    return false;
  }

  private async performUpdate(): Promise<void> {
    const isGlobal = this.isGlobalInstallation();
    const pkgManager = this.detectPackageManager();

    console.log(`Updating ${this.pkgName}...`);

    try {
      let command = '';
      if (isGlobal) {
        command = `npm install -g ${this.pkgName}`;
      } else {
        switch (pkgManager) {
          case 'yarn':
            command = `yarn add ${this.pkgName}`;
            break;
          case 'pnpm':
            command = `pnpm add ${this.pkgName}`;
            break;
          default:
            command = `npm install ${this.pkgName}`;
            break;
        }
      }

      execSync(command, { stdio: 'inherit' });
      console.log('Update completed successfully!');

      // Re-execute the original command
      this.reExecuteCommand();
    } catch (error) {
      console.error('Update failed:', error);
    }
  }

  private isGlobalInstallation(): boolean {
    try {
      const globalRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
      return __dirname.startsWith(globalRoot);
    } catch {
      return false;
    }
  }

  private detectPackageManager(): string {
    if (existsSync('yarn.lock')) return 'yarn';
    if (existsSync('pnpm-lock.yaml')) return 'pnpm';
    return 'npm';
  }

  private reExecuteCommand(): void {
    const child = spawn(process.argv[0], process.argv.slice(1), { stdio: 'inherit' });
    child.on('close', (code) => process.exit(code ?? 0));
  }
}

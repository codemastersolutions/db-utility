import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ContainerManager {
  async checkDocker(): Promise<boolean> {
    try {
      await execAsync('docker --version');
      return true;
    } catch {
      return false;
    }
  }

  async startContainer(
    image: string,
    env: Record<string, string>,
    port: number,
    internalPort: number = 5432,
    volumes?: Record<string, string>,
  ): Promise<string> {
    const envString = Object.entries(env)
      .map(([key, value]) => `-e ${key}='${value}'`)
      .join(' ');

    const volumeString = volumes
      ? Object.entries(volumes)
          .map(([host, container]) => `-v "${host}:${container}"`)
          .join(' ')
      : '';

    // --rm ensures container is removed when stopped (though we manually stop/rm to be safe)
    // -d detached
    // -p hostPort:containerPort
    const parts = ['docker', 'run', '-d', '--rm', '-p', `${port}:${internalPort}`];

    if (envString) parts.push(envString);
    if (volumeString) parts.push(volumeString);

    parts.push(image);

    const command = parts.join(' ');

    try {
      const { stdout } = await execAsync(command);
      const containerId = stdout.trim();

      // Wait for container to be ready (basic wait, real readiness check is better handled by connection retries)
      // But for some DBs like MSSQL/Oracle, startup is slow.
      // We will handle readiness by retrying connection in the tester.

      return containerId;
    } catch (error) {
      throw new Error(
        `Failed to start container: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    try {
      await execAsync(`docker stop ${containerId}`);
    } catch (error) {
      console.error(`Failed to stop container ${containerId}:`, error);
    }
  }

  async execInContainer(
    containerId: string,
    command: string,
    env?: Record<string, string>,
  ): Promise<string> {
    try {
      const envString = env
        ? Object.entries(env)
            .map(([key, value]) => `-e ${key}='${value}'`)
            .join(' ')
        : '';
      const { stdout } = await execAsync(`docker exec ${envString} ${containerId} ${command}`);
      return stdout;
    } catch (error: unknown) {
      const execError = error as { stderr?: string; stdout?: string };
      const stderr = execError.stderr ? `\nStderr: ${execError.stderr}` : '';
      const stdout = execError.stdout ? `\nStdout: ${execError.stdout}` : '';
      throw new Error(
        `Failed to execute command in container: ${error instanceof Error ? error.message : String(error)}${stdout}${stderr}`,
      );
    }
  }
}

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const shellEscape = (value: string): string => {
  const escapedValue = value.replaceAll(`'`, `'"'"'`);
  return `'${escapedValue}'`;
};

export class ContainerManager {
  async checkDocker(): Promise<boolean> {
    try {
      await execAsync('docker --version');
      return true;
    } catch {
      return false;
    }
  }

  async imageExists(image: string): Promise<boolean> {
    try {
      await execAsync(`docker manifest inspect ${shellEscape(image)}`);
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
      .map(([key, value]) => `-e ${key}=${shellEscape(value)}`)
      .join(' ');

    const volumeString = volumes
      ? Object.entries(volumes)
          .map(([host, container]) => `-v "${host}:${container}"`)
          .join(' ')
      : '';

    // NOTE: intentionally NOT using --rm. If the container dies during startup
    // (e.g. MSSQL exits due to OOM or password policy), we still need to read
    // its logs with `docker logs`. We clean up explicitly with `docker rm -f`
    // in stopContainer().
    // -d detached
    // -p hostPort:containerPort
    const parts = ['docker', 'run', '-d', '-p', `${port}:${internalPort}`];

    if (envString) parts.push(envString);
    if (volumeString) parts.push(volumeString);

    parts.push(image);

    const command = parts.join(' ');

    try {
      const { stdout, stderr } = await execAsync(command);
      const containerId = stdout.trim();

      if (!containerId) {
        const detail = stderr ? `\nstderr: ${stderr}` : '';
        throw new Error(`docker run produced no container id.${detail}`);
      }

      return containerId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stderr =
        error && typeof error === 'object' && 'stderr' in error
          ? String((error as { stderr?: unknown }).stderr ?? '')
          : '';
      throw new Error(
        `Failed to start container: ${message}${stderr ? `\nstderr: ${stderr}` : ''}`,
      );
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    try {
      // Use rm -f so we also clean up containers that already exited
      // (they would otherwise linger now that we dropped --rm on start).
      await execAsync(`docker rm -f ${shellEscape(containerId)}`);
    } catch (error) {
      // "No such container" is not an error — it just means cleanup already happened.
      const message = error instanceof Error ? error.message : String(error);
      if (typeof message === 'string' && /No such container/i.test(message)) return;
      console.error(`Failed to stop/remove container ${containerId}:`, error);
    }
  }

  async isContainerRunning(containerId: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `docker inspect -f '{{.State.Running}}' ${shellEscape(containerId)}`,
      );
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  async getLastLogs(containerId: string, lines = 60): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(
        `docker logs --tail ${lines} ${shellEscape(containerId)} 2>&1`,
      );
      const combined = (stdout || '') + (stderr || '');
      if (combined.trim().length > 0) return combined;

      // Container exited so quickly there are no logs yet — try inspecting the state.
      const { stdout: inspectOut } = await execAsync(
        `docker inspect -f 'Status={{.State.Status}} Exit={{.State.ExitCode}} Error={{.State.Error}}' ${shellEscape(containerId)}`,
      );
      return `(container produced no runtime logs; state: ${inspectOut.trim()})`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `(could not retrieve container logs: ${message})`;
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
      const { stdout } = await execAsync(
        `docker exec ${envString} ${shellEscape(containerId)} ${command}`,
      );
      return stdout;
    } catch (error: unknown) {
      const commandError = error as { message?: string; stderr?: string; stdout?: string };
      const stderr = commandError.stderr ? `\nStderr: ${commandError.stderr}` : '';
      const stdout = commandError.stdout ? `\nStdout: ${commandError.stdout}` : '';
      const message = commandError.message ?? String(error);
      throw new Error(`Failed to execute command in container: ${message}${stdout}${stderr}`);
    }
  }

  async copyFromContainer(
    containerId: string,
    sourcePath: string,
    destinationPath: string,
  ): Promise<void> {
    try {
      const containerSource = `${containerId}:${sourcePath}`;
      await execAsync(`docker cp ${shellEscape(containerSource)} ${shellEscape(destinationPath)}`);
    } catch (error) {
      throw new Error(
        `Failed to copy file from container: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

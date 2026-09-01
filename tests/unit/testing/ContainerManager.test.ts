import { exec } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { ContainerManager } from '../../../src/testing/ContainerManager';

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('ContainerManager', () => {
  it('checkDocker should return true if docker is available', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      cb(null, { stdout: 'Docker version 20.10.12' });
    });

    const manager = new ContainerManager();
    const result = await manager.checkDocker();
    expect(result).toBe(true);
    expect(exec).toHaveBeenCalledWith('docker --version', expect.any(Function));
  });

  it('checkDocker should return false if docker is not available', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      cb(new Error('Command not found'));
    });

    const manager = new ContainerManager();
    const result = await manager.checkDocker();
    expect(result).toBe(false);
  });

  it('imageExists should return true when docker manifest inspect succeeds', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      cb(null, { stdout: '{}' });
    });

    const manager = new ContainerManager();
    const result = await manager.imageExists('postgres:18.4');

    expect(result).toBe(true);
    expect(exec).toHaveBeenCalledWith(
      "docker manifest inspect 'postgres:18.4'",
      expect.any(Function),
    );
  });

  it('imageExists should return false when docker manifest inspect fails', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      cb(new Error('not found'));
    });

    const manager = new ContainerManager();
    const result = await manager.imageExists('postgres:99.99');

    expect(result).toBe(false);
  });

  it('startContainer should run correct docker command (no --rm, escaped env values)', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      cb(null, { stdout: 'container123\n', stderr: '' });
    });

    const manager = new ContainerManager();
    const id = await manager.startContainer('postgres:14', { FOO: 'bar' }, 5432, 5432);

    expect(id).toBe('container123');
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('docker run -d -p 5432:5432'),
      expect.any(Function),
    );
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining("-e FOO='bar' postgres:14"),
      expect.any(Function),
    );
    expect(exec).toHaveBeenCalledWith(expect.not.stringContaining('--rm'), expect.any(Function));
  });

  it('startContainer should include stderr detail when docker run fails or returns empty id', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((_cmd, cb) => {
      // promisify(exec) attaches stderr/stdout onto the error when the callback errors.
      const error = new Error('exit code 125') as Error & { stderr: string; stdout: string };
      (error as { stderr: string }).stderr = 'Unable to find image';
      (error as { stdout: string }).stdout = '';
      cb(error);
    });

    const manager = new ContainerManager();
    await expect(manager.startContainer('broken:tag', {}, 1234)).rejects.toThrow(
      /Unable to find image/,
    );
  });

  it('stopContainer should use docker rm -f (not docker stop) and swallow No such container', async () => {
    const calls: unknown[] = [];
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      calls.push(cmd);
      if (String(cmd).includes('NoSuch')) {
        cb(new Error('Error response from daemon: No such container: NoSuch'));
        return;
      }
      cb(null, { stdout: '' });
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const manager = new ContainerManager();
    await manager.stopContainer('container123');
    await manager.stopContainer('NoSuch');

    expect(calls).toContain("docker rm -f 'container123'");
    expect(calls).toContain("docker rm -f 'NoSuch'");
    // NoSuch should NOT trigger console.error
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('copyFromContainer should run correct docker cp command', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      cb(null, { stdout: '' });
    });

    const manager = new ContainerManager();
    await manager.copyFromContainer('container123', '/tmp/test.bak', '/host/test.bak');

    expect(exec).toHaveBeenCalledWith(
      "docker cp 'container123:/tmp/test.bak' '/host/test.bak'",
      expect.any(Function),
    );
  });

  it('isContainerRunning should return true when State.Running is true', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      cb(null, { stdout: 'true\n' });
    });

    const manager = new ContainerManager();
    const alive = await manager.isContainerRunning('c1');
    expect(alive).toBe(true);
    expect(exec).toHaveBeenCalledWith(
      "docker inspect -f '{{.State.Running}}' 'c1'",
      expect.any(Function),
    );
  });

  it('isContainerRunning should return false when State.Running is false or inspect fails', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      cb(new Error('No such container'));
    });

    const manager = new ContainerManager();
    const alive = await manager.isContainerRunning('absent');
    expect(alive).toBe(false);
  });

  it('getLastLogs should return combined stdout+stderr from docker logs', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      if (String(cmd).startsWith('docker logs')) {
        cb(null, { stdout: 'line1\nline2\n', stderr: 'warn1\nwarn2\n' });
        return;
      }
      cb(new Error('unexpected'));
    });

    const manager = new ContainerManager();
    const logs = await manager.getLastLogs('c1', 10);
    expect(logs).toContain('line1\nline2');
    expect(logs).toContain('warn1\nwarn2');
    expect(exec).toHaveBeenCalledWith("docker logs --tail 10 'c1' 2>&1", expect.any(Function));
  });

  it('getLastLogs should return a fallback message when docker logs fails', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      cb(new Error('boom'));
    });

    const manager = new ContainerManager();
    const logs = await manager.getLastLogs('c1');
    expect(logs).toContain('could not retrieve container logs');
  });
});

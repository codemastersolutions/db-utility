import { exec } from 'child_process';
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

  it('startContainer should run correct docker command', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      cb(null, { stdout: 'container123\n' });
    });

    const manager = new ContainerManager();
    const id = await manager.startContainer('postgres:14', { FOO: 'bar' }, 5432, 5432);

    expect(id).toBe('container123');
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining("docker run -d --rm -p 5432:5432 -e FOO='bar' postgres:14"),
      expect.any(Function),
    );
  });

  it('stopContainer should run correct docker stop command', async () => {
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd, cb) => {
      cb(null, { stdout: '' });
    });

    const manager = new ContainerManager();
    await manager.stopContainer('container123');

    expect(exec).toHaveBeenCalledWith('docker stop container123', expect.any(Function));
  });
});

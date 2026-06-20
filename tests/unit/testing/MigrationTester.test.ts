import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MigrationTester } from '../../../src/testing/MigrationTester';
import { ContainerManager } from '../../../src/testing/ContainerManager';
import { ConnectionFactory } from '../../../src/database/ConnectionFactory';
import * as fs from 'node:fs';
import inquirer from 'inquirer';
import { join } from 'node:path';
import { SequelizeRunner } from '../../../src/testing/runners/SequelizeRunner';
import { PackageManager } from '../../../src/utils/PackageManager';

const SequelizeRunnerMock = SequelizeRunner as unknown as {
  mockImplementation: (fn: new () => unknown) => void;
};

vi.mock('../../../src/testing/ContainerManager');
vi.mock('../../../src/database/ConnectionFactory');
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
vi.mock('../../../src/testing/runners/SequelizeRunner', () => ({
  SequelizeRunner: vi.fn(),
}));
vi.mock('../../../src/testing/runners/TypeORMRunner', () => ({
  TypeORMRunner: vi.fn(),
}));
vi.mock('../../../src/utils/PackageManager', () => ({
  PackageManager: vi.fn(),
}));
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({
      install: true,
      scope: 'global',
      versionInput: '6',
      uninstall: true,
    }),
  },
}));

describe('MigrationTester', () => {
  let containerManager: ContainerManager;
  let tester: MigrationTester;
  let mockPackageManager: {
    isInstalled: ReturnType<typeof vi.fn>;
    install: ReturnType<typeof vi.fn>;
    uninstall: ReturnType<typeof vi.fn>;
    getGlobalInstallPath: ReturnType<typeof vi.fn>;
    resolveVersion: ReturnType<typeof vi.fn>;
    getInstalledVersion: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    containerManager = new ContainerManager();

    mockPackageManager = {
      isInstalled: vi.fn().mockResolvedValue(false),
      install: vi.fn().mockResolvedValue(undefined),
      uninstall: vi.fn().mockResolvedValue(undefined),
      getGlobalInstallPath: vi.fn().mockResolvedValue('/global/path'),
      resolveVersion: vi.fn().mockResolvedValue('6.0.0'),
      getInstalledVersion: vi.fn().mockResolvedValue('6.37.5'),
    };
    const PackageManagerMock = PackageManager as unknown as {
      mockImplementation: (fn: new () => unknown) => void;
    };
    PackageManagerMock.mockImplementation(function () {
      return mockPackageManager;
    } as unknown as new () => unknown);

    tester = new MigrationTester(containerManager);
    vi.clearAllMocks();
  });

  it('should skip if docker is not available', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(false);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await tester.test('sequelize', 'dir');

    expect(consoleSpy).toHaveBeenCalledWith('Docker not found. Skipping migration tests.');
    consoleSpy.mockRestore();
  });

  it('should run tests for specified engines', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(containerManager.startContainer).mockResolvedValue('container123');

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('14.0'),
    };
    vi.mocked(ConnectionFactory.create).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    SequelizeRunnerMock.mockImplementation(function () {
      return mockRunner;
    } as unknown as new () => unknown);

    // Mock console.log/table to avoid clutter
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});

    vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
      const pathStr = String(path);
      if (pathStr.endsWith('package.json')) return false;
      if (pathStr.endsWith('database-info.json')) return false;
      return true;
    });

    await tester.test('sequelize', 'dir', ['postgres:14']);

    // Debug failure
    if (tableSpy.mock.calls.length > 0) {
      console.error('Table output:', JSON.stringify(tableSpy.mock.calls[0][0], null, 2));
    }

    expect(containerManager.startContainer).toHaveBeenCalled();
    expect(mockConnector.connect).toHaveBeenCalled();
    expect(mockRunner.run).toHaveBeenCalled();
    expect(containerManager.stopContainer).toHaveBeenCalledWith('container123');
  });

  it('should use globally installed ORM and pass its path to the runner', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(containerManager.startContainer).mockResolvedValue('container123');

    mockPackageManager.isInstalled.mockImplementation(async (_pkg: string, scope: string) => {
      if (scope === 'global') return true;
      return false;
    });

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('14.0'),
    };
    vi.mocked(ConnectionFactory.create).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    SequelizeRunnerMock.mockImplementation(function () {
      return mockRunner;
    } as unknown as new () => unknown);

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['postgres:14']);

    expect(mockPackageManager.getGlobalInstallPath).toHaveBeenCalled();
    expect(SequelizeRunner).toHaveBeenCalledWith('/global/path/sequelize');
  });

  it('should read engines from database-info.json if not specified', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(containerManager.startContainer).mockResolvedValue('container123');

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('14.0'),
    };
    vi.mocked(ConnectionFactory.create).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    SequelizeRunnerMock.mockImplementation(function () {
      return mockRunner;
    } as unknown as new () => unknown);

    vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
      const pathStr = String(path);
      if (pathStr.endsWith('database-info.json')) return true;
      if (pathStr.endsWith('package.json')) return false;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ type: 'postgres', version: '14.5' }),
    );

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});

    await tester.test('sequelize', 'dir');

    expect(fs.readFileSync).toHaveBeenCalled();
    expect(containerManager.startContainer).toHaveBeenCalledWith(
      expect.stringContaining('postgres:14'),
      expect.any(Object),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('should stop when no engines are provided and database-info.json is missing', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await tester.test('sequelize', 'dir');

    expect(consoleSpy).toHaveBeenCalledWith(
      'No database engines specified and no database-info.json found.',
    );
    expect(containerManager.startContainer).not.toHaveBeenCalled();
  });

  it('should stop when user declines ORM installation', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ install: false });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['postgres:14']);

    expect(consoleSpy).toHaveBeenCalledWith('sequelize is required to run tests.');
    expect(containerManager.startContainer).not.toHaveBeenCalled();
  });

  it('should stop when ORM version cannot be resolved', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ install: true })
      .mockResolvedValueOnce({ scope: 'global', versionInput: '6' });
    mockPackageManager.resolveVersion.mockResolvedValueOnce(null);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['postgres:14']);

    expect(consoleSpy).toHaveBeenCalledWith('Versão 6 não encontrada para sequelize.');
    expect(containerManager.startContainer).not.toHaveBeenCalled();
  });

  it('should use bypassSafety for MSSQL database creation', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(containerManager.startContainer).mockResolvedValue('container123');

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('2019'),
    };
    vi.mocked(ConnectionFactory.create).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    SequelizeRunnerMock.mockImplementation(function () {
      return mockRunner;
    } as unknown as new () => unknown);

    vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
      const pathStr = String(path);
      if (pathStr.endsWith('package.json')) return false;
      return true;
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['mssql:2019']);

    expect(mockConnector.query).toHaveBeenCalledWith(
      'CREATE DATABASE [testdb]',
      expect.any(Array),
      { bypassSafety: true },
    );
  });

  it('should setup backup volume and execute backup command when backup flag is true', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(containerManager.startContainer).mockResolvedValue('container123');
    vi.mocked(containerManager.execInContainer).mockResolvedValue('');
    vi.mocked(containerManager.copyFromContainer).mockResolvedValue(undefined);

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('14.0'),
    };
    vi.mocked(ConnectionFactory.create).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    SequelizeRunnerMock.mockImplementation(function () {
      return mockRunner;
    } as unknown as new () => unknown);

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['postgres:14'], true); // backup = true

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('exports'), {
      recursive: true,
    });

    expect(containerManager.startContainer).toHaveBeenCalledWith(
      expect.stringContaining('postgres:14'),
      expect.any(Object),
      expect.any(Number),
      expect.any(Number),
    );

    expect(containerManager.execInContainer).toHaveBeenCalledWith(
      'container123',
      expect.stringContaining('pg_dump -U postgres testdb > /tmp/testdb.sql'),
      expect.any(Object),
    );
    expect(containerManager.copyFromContainer).toHaveBeenCalledWith(
      'container123',
      '/tmp/testdb.sql',
      join(process.cwd(), 'exports', 'backups', 'Postgres 14', 'testdb.sql'),
    );
  });

  it('should execute backup command for MSSQL', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(containerManager.startContainer).mockResolvedValue('container123');
    vi.mocked(containerManager.copyFromContainer).mockResolvedValue(undefined);
    // Mock execInContainer for two calls:
    // 1. ensure backup dir exists
    // 2. probe check (ls) -> resolve (success)
    // 3. backup command -> resolve (success)
    vi.mocked(containerManager.execInContainer)
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('/opt/mssql-tools18/bin/sqlcmd')
      .mockResolvedValueOnce('');

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('2019'),
    };
    vi.mocked(ConnectionFactory.create).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    SequelizeRunnerMock.mockImplementation(function () {
      return mockRunner;
    } as unknown as new () => unknown);

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['mssql:2019'], true);

    expect(containerManager.execInContainer).toHaveBeenNthCalledWith(
      1,
      'container123',
      'mkdir -p /var/opt/mssql/backup',
    );

    expect(containerManager.execInContainer).toHaveBeenNthCalledWith(
      2,
      'container123',
      'ls /opt/mssql-tools18/bin/sqlcmd',
    );

    expect(containerManager.execInContainer).toHaveBeenCalledWith(
      'container123',
      'ls /opt/mssql-tools18/bin/sqlcmd',
    );

    expect(containerManager.execInContainer).toHaveBeenCalledWith(
      'container123',
      expect.stringContaining('/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -Q'),
      expect.objectContaining({ SQLCMDPASSWORD: expect.any(String) }),
    );
    expect(containerManager.copyFromContainer).toHaveBeenCalledWith(
      'container123',
      '/var/opt/mssql/backup/testdb.bak',
      join(process.cwd(), 'exports', 'backups', 'Microsoft SQL Server 2019', 'testdb.bak'),
    );
  });

  it('should fallback to legacy sqlcmd path when mssql-tools18 is unavailable', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(containerManager.startContainer).mockResolvedValue('container123');
    vi.mocked(containerManager.copyFromContainer).mockResolvedValue(undefined);
    vi.mocked(containerManager.execInContainer)
      .mockResolvedValueOnce('')
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce('');

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('2019'),
    };
    vi.mocked(ConnectionFactory.create).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    SequelizeRunnerMock.mockImplementation(function () {
      return mockRunner;
    } as unknown as new () => unknown);

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['mssql:2019'], true);

    expect(containerManager.execInContainer).toHaveBeenNthCalledWith(
      3,
      'container123',
      expect.stringContaining('/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -Q'),
      expect.objectContaining({ SQLCMDPASSWORD: expect.any(String) }),
    );
    expect(containerManager.execInContainer).not.toHaveBeenNthCalledWith(
      3,
      'container123',
      expect.stringContaining(' -C -Q '),
      expect.any(Object),
    );
  });

  it('should warn and continue when removing an existing backup fails', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(containerManager.startContainer).mockResolvedValue('container123');
    vi.mocked(containerManager.execInContainer).mockResolvedValue('');
    vi.mocked(containerManager.copyFromContainer).mockResolvedValue(undefined);

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('14.0'),
    };
    vi.mocked(ConnectionFactory.create).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    SequelizeRunnerMock.mockImplementation(function () {
      return mockRunner;
    } as unknown as new () => unknown);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.unlinkSync).mockImplementation(() => {
      throw new Error('permission denied');
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['postgres:14'], true);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to remove previous backup'),
    );
    expect(containerManager.copyFromContainer).toHaveBeenCalledWith(
      'container123',
      '/tmp/testdb.sql',
      join(process.cwd(), 'exports', 'backups', 'Postgres 14', 'testdb.sql'),
    );
  });

  it('should detect installed version when version is current', async () => {
    vi.mocked(containerManager.checkDocker).mockResolvedValue(true);
    vi.mocked(containerManager.startContainer).mockResolvedValue('container123');

    vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) =>
      String(path).endsWith('package.json'),
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        dependencies: {
          sequelize: '^6.37.8',
        },
      }),
    );

    mockPackageManager.isInstalled.mockImplementation(async (_pkg: string, scope: string) => {
      if (scope === 'local') return true;
      return false;
    });
    mockPackageManager.getInstalledVersion.mockResolvedValue('6.37.5');

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockResolvedValue(true),
      getVersion: vi.fn().mockResolvedValue('14.0'),
    };
    vi.mocked(ConnectionFactory.create).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    SequelizeRunnerMock.mockImplementation(function () {
      return mockRunner;
    } as unknown as new () => unknown);

    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['postgres:14']);

    expect(mockPackageManager.getInstalledVersion).toHaveBeenCalled();

    // Verify table output
    const tableCall = tableSpy.mock.calls[0][0];
    expect(tableCall[0].Engine).toContain('sequelize v6.37.5');
  });
});

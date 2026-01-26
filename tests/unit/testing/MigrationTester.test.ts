import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MigrationTester } from '../../../src/testing/MigrationTester';
import { ContainerManager } from '../../../src/testing/ContainerManager';
import { ConnectionFactory } from '../../../src/database/ConnectionFactory';
import * as fs from 'fs';
import { SequelizeRunner } from '../../../src/testing/runners/SequelizeRunner';
import { PackageManager } from '../../../src/utils/PackageManager';

vi.mock('../../../src/testing/ContainerManager');
vi.mock('../../../src/database/ConnectionFactory');
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
}));
vi.mock('../../../src/testing/runners/SequelizeRunner');
vi.mock('../../../src/testing/runners/TypeORMRunner');
vi.mock('../../../src/utils/PackageManager');

describe('MigrationTester', () => {
  let containerManager: ContainerManager;
  let tester: MigrationTester;
  let mockPackageManager: any;

  beforeEach(() => {
    containerManager = new ContainerManager();

    mockPackageManager = {
      isInstalled: vi.fn().mockResolvedValue(true),
      install: vi.fn().mockResolvedValue(undefined),
      uninstall: vi.fn().mockResolvedValue(undefined),
      getGlobalInstallPath: vi.fn().mockResolvedValue('/global/path'),
      resolveVersion: vi.fn().mockResolvedValue('6.0.0'),
      getInstalledVersion: vi.fn().mockResolvedValue('6.37.5'),
    };
    (PackageManager as any).mockImplementation(function () {
      return mockPackageManager;
    });

    tester = new MigrationTester(containerManager);
    vi.clearAllMocks();
  });

  it('should skip if docker is not available', async () => {
    (containerManager.checkDocker as any).mockResolvedValue(false);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await tester.test('sequelize', 'dir');

    expect(consoleSpy).toHaveBeenCalledWith('Docker not found. Skipping migration tests.');
    consoleSpy.mockRestore();
  });

  it('should run tests for specified engines', async () => {
    (containerManager.checkDocker as any).mockResolvedValue(true);
    (containerManager.startContainer as any).mockResolvedValue('container123');

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      getVersion: vi.fn().mockResolvedValue('14.0'),
    };
    (ConnectionFactory.create as any).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    (SequelizeRunner as any).mockImplementation(function () {
      return mockRunner;
    });

    // Mock console.log/table to avoid clutter
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});

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

  it('should read engines from database-info.json if not specified', async () => {
    (containerManager.checkDocker as any).mockResolvedValue(true);
    (containerManager.startContainer as any).mockResolvedValue('container123');

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      getVersion: vi.fn().mockResolvedValue('14.0'),
    };
    (ConnectionFactory.create as any).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    (SequelizeRunner as any).mockImplementation(function () {
      return mockRunner;
    });

    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(JSON.stringify({ type: 'postgres', version: '14.5' }));

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});

    await tester.test('sequelize', 'dir');

    expect(fs.readFileSync).toHaveBeenCalled();
    expect(containerManager.startContainer).toHaveBeenCalledWith(
      expect.stringContaining('postgres:14'),
      expect.any(Object),
      expect.any(Number),
      expect.any(Number),
      undefined,
    );
  });

  it('should use bypassSafety for MSSQL database creation', async () => {
    (containerManager.checkDocker as any).mockResolvedValue(true);
    (containerManager.startContainer as any).mockResolvedValue('container123');

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      getVersion: vi.fn().mockResolvedValue('2019'),
    };
    (ConnectionFactory.create as any).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    (SequelizeRunner as any).mockImplementation(function () {
      return mockRunner;
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
    (containerManager.checkDocker as any).mockResolvedValue(true);
    (containerManager.startContainer as any).mockResolvedValue('container123');
    (containerManager.execInContainer as any).mockResolvedValue('');

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      getVersion: vi.fn().mockResolvedValue('14.0'),
    };
    (ConnectionFactory.create as any).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    (SequelizeRunner as any).mockImplementation(function () {
      return mockRunner;
    });

    (fs.existsSync as any).mockReturnValue(false);
    (fs.mkdirSync as any).mockReturnValue(undefined);
    (fs.chmodSync as any).mockReturnValue(undefined);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['postgres:14'], true); // backup = true

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('exports'), {
      recursive: true,
    });
    expect(fs.chmodSync).toHaveBeenCalledWith(expect.stringContaining('exports'), '777');

    const backupDir = require('path').join(process.cwd(), 'exports', 'backups', 'Postgres 14');
    expect(containerManager.startContainer).toHaveBeenCalledWith(
      expect.stringContaining('postgres:14'),
      expect.any(Object),
      expect.any(Number),
      expect.any(Number),
      { [backupDir]: '/backup' },
    );

    expect(containerManager.execInContainer).toHaveBeenCalledWith(
      'container123',
      expect.stringContaining('pg_dump'),
      expect.any(Object),
    );
  });

  it('should execute backup command for MSSQL', async () => {
    (containerManager.checkDocker as any).mockResolvedValue(true);
    (containerManager.startContainer as any).mockResolvedValue('container123');
    // Mock execInContainer for two calls:
    // 1. probe check (ls) -> resolve (success)
    // 2. backup command -> resolve (success)
    (containerManager.execInContainer as any)
      .mockResolvedValueOnce('/opt/mssql-tools18/bin/sqlcmd') // ls success
      .mockResolvedValueOnce(''); // backup success

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      getVersion: vi.fn().mockResolvedValue('2019'),
    };
    (ConnectionFactory.create as any).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    (SequelizeRunner as any).mockImplementation(function () {
      return mockRunner;
    });

    (fs.existsSync as any).mockReturnValue(false);
    (fs.mkdirSync as any).mockReturnValue(undefined);
    (fs.chmodSync as any).mockReturnValue(undefined);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['mssql:2019'], true);

    expect(containerManager.execInContainer).toHaveBeenNthCalledWith(
      1,
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
      { SQLCMDPASSWORD: 'StrongPassword123!' },
    );
  });

  it('should detect installed version when version is current', async () => {
    (containerManager.checkDocker as any).mockResolvedValue(true);
    (containerManager.startContainer as any).mockResolvedValue('container123');

    // Ensure isInstalled returns true so it treats as 'current'
    mockPackageManager.isInstalled.mockResolvedValue(true);
    mockPackageManager.getInstalledVersion.mockResolvedValue('6.37.5');

    const mockConnector = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      getVersion: vi.fn().mockResolvedValue('14.0'),
    };
    (ConnectionFactory.create as any).mockReturnValue(mockConnector);

    const mockRunner = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    (SequelizeRunner as any).mockImplementation(function () {
      return mockRunner;
    });

    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await tester.test('sequelize', 'dir', ['postgres:14']);

    expect(mockPackageManager.getInstalledVersion).toHaveBeenCalled();

    // Verify table output
    const tableCall = tableSpy.mock.calls[0][0];
    expect(tableCall[0].Engine).toContain('sequelize v6.37.5');
  });
});

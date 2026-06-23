# DbUtility

> The most powerful database utility.

[![npm version](https://img.shields.io/npm/v/@codemastersolutions/db-utility.svg)](https://www.npmjs.com/package/@codemastersolutions/db-utility)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[🇧🇷 Português](./README.pt-BR.md) | [🇪🇸 Español](./README.es.md)**

DbUtility is a powerful utility for manipulating Microsoft SQL Server, MySQL, and PostgreSQL databases. Developed in Node.js and TypeScript, it aims to simplify database connection, introspection, model export, and migration creation.

## Features

- **Multi-Database Support**: Connect to Microsoft SQL Server, MySQL, and PostgreSQL using official drivers (`mssql`, `mysql2`, `pg`).
- **Flexible Configuration**: Connection details via CLI, `.env`, JSON configuration files.
- **Introspection**: Analyze your database to list tables, views, stored procedures, functions, and triggers.
- **Model Export**: Export database tables to Sequelize, TypeORM, Prisma, and Mongoose models.
- **Migration Generation**: Create schema and data migrations from existing database tables for Sequelize and TypeORM.

## Installation

```bash
npm install @codemastersolutions/db-utility
# or globally
npm install -g @codemastersolutions/db-utility
```

## MSSQL Integration Tests

DbUtility includes opt-in integration tests for Microsoft SQL Server that validate the real migration runners against a Docker container.

These tests currently cover:

- Sequelize migrations with long MSSQL string columns
- TypeORM migrations with long MSSQL string columns
- Sequelize migrations that omit invalid numeric defaults for MSSQL date/datetimeoffset columns
- Sequelize migrations that preserve composite foreign keys with matching referenced columns
- Sequelize migrations that preserve self-referencing composite foreign keys
- Sequelize migrations that preserve composite foreign keys with `ON DELETE SET NULL`
- TypeORM migrations that preserve MSSQL date/datetimeoffset types and omit invalid numeric defaults
- Real inserts of values longer than 4000 characters without parameter size errors

Prerequisites:

- Docker installed and available in your `PATH`
- Development dependencies installed with `pnpm install`

Available scripts:

```bash
# Run both MSSQL integration suites
pnpm run test:integration:mssql

# Run only Sequelize + MSSQL integrations
pnpm run test:integration:mssql:sequelize

# Run only TypeORM + MSSQL integration
pnpm run test:integration:mssql:typeorm
```

Notes:

- These scripts automatically enable `DBUTILITY_RUN_DOCKER_INTEGRATION=1`.
- They use `cross-env`, so the same commands work on macOS, Linux, and Windows.
- They are intentionally separate from `pnpm test` to keep the default test suite fast.
- The tests start real SQL Server containers and may take longer than unit tests.

## Internet Usage

This library uses your internet connection to check for updates on the npm registry. This check is performed automatically (default: daily) when you execute a CLI command.

- **Timeout**: The check has a 10-second timeout.
- **Offline**: If no internet connection is detected, the check is silently skipped.
- **Privacy**: No personal data is collected. Only the package version is compared.
- **Configuration**: You can disable this feature or change the frequency in the configuration file.

## Configuration

### Initialization

You can initialize a default configuration file using the CLI command:

```bash
dbutility --init
```

If the file already exists, you can force recreation with default values:

```bash
dbutility --init -f
# or
dbutility --init --force
```

### Configuration File (dbutility.config.json)

The configuration file allows you to define CLI language, output directories, naming patterns, and database connection settings.

```json
{
  "language": "en",
  "versionCheck": {
    "enabled": true,
    "frequency": "daily"
  },
  "introspection": {
    "outputDir": "db-utility-introspect"
  },
  "migrations": {
    "outputDir": "db-utility-migrations",
    "fileNamePattern": "timestamp-prefix",
    "data": true,
    "dataTables": ["users", { "table": "logs", "where": "level = 'ERROR'" }],
    "backup": true,
    "disableForeignKeys": false
  },
  "connection": {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "myuser",
    "password": "mypassword",
    "database": "mydb",
    "ssl": false,
    "connectTimeoutMs": 15000
  },
  "connections": {
    "development": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "username": "root",
      "password": "password",
      "database": "dev_db",
      "connectTimeoutMs": 15000
    },
    "production": {
      "type": "postgres",
      "host": "prod-db",
      "port": 5432,
      "username": "admin",
      "password": "secure_password",
      "database": "prod_db",
      "ssl": true,
      "connectTimeoutMs": 15000
    }
  }
}
```

### Version Check Configuration

You can configure the automatic version check in `dbutility.config.json`.

```json
{
  "versionCheck": {
    "enabled": true,
    "frequency": "daily"
  }
}
```

- **`enabled`** (boolean): Set to `true` to enable version checking, `false` to disable it. Default: `true`.
- **`frequency`** (string): How often to check for updates.
  - `"daily"`: Once a day (default).
  - `"weekly"`: Once a week.
  - `"monthly"`: Once a month.

### Advanced Data Extraction Configuration

The `dataTables` option allows you to specify which tables should have their data exported (for seeds). You can provide a simple list of table names or an object with a `where` clause to filter the data.

```json
"dataTables": [
  "roles",
  "permissions",
  {
    "table": "users",
    "where": "active = 1 AND created_at > '2023-01-01'",
    "disableIdentity": true
  },
  {
    "table": "logs",
    "where": "level = 'ERROR'"
  }
]
```

The `disableIdentity` option (default: `false`) allows inserting explicit values into auto-increment/identity columns. This is useful when you want to preserve the original IDs from the source database.

- **MSSQL**: Wraps inserts with `SET IDENTITY_INSERT [Table] ON/OFF`.
- **PostgreSQL**: Resets the sequence value after insertion using `setval` so subsequent inserts don't fail.
- **Other Databases (MySQL, SQLite)**: Includes the identity column in the insert payload (these databases typically update the auto-increment counter automatically).

### Foreign Key Migration Configuration

Set `migrations.disableForeignKeys` to `true` to skip generating `add-fks-*` migration files. The default value is `false`.

```json
{
  "migrations": {
    "disableForeignKeys": true
  }
}
```

### Multiple Connections

You can define multiple connections within the `connections` property and use them in the CLI with the `--conn <name>` flag.

Example:

```bash
dbutility connect --conn development
```

### Configuration Priority

The configuration is loaded with the following priority order (higher priority overrides lower):

1. **CLI Flags**: Arguments passed directly to the command (e.g., `-u user`).
2. **Configuration File**: Settings in `dbutility.config.json`.
3. **Environment Variables**: Variables defined in `.env`.

This allows you to have base settings in `.env`, project-specific settings in `dbutility.config.json`, and override specific values (like password) via CLI when needed.

### Environment Variables (.env)

You can also configure DbUtility using environment variables.

```env
# Language (pt-BR, en, es)
DB_UTILITY_LANG=en

# Output Directories
DB_UTILITY_INTROSPECTION_OUTPUT_DIR=my-introspect-dir
DB_UTILITY_MIGRATIONS_OUTPUT_DIR=my-migrations-dir

# Migration File Name Pattern (timestamp-prefix, prefix-timestamp)
DB_UTILITY_MIGRATIONS_FILE_NAME_PATTERN=prefix-timestamp

# Migration Data (true/false)
DB_UTILITY_MIGRATIONS_DATA=true

# Migration Data Tables (Comma separated)
DB_UTILITY_MIGRATIONS_DATA_TABLES=users,roles

# Migration Backup (true/false)
DB_UTILITY_MIGRATIONS_BACKUP=true

# Disable foreign key migration generation (true/false)
DB_UTILITY_MIGRATIONS_DISABLE_FOREIGN_KEYS=true

# Database Connection (Fallback/Base)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=mydb
DB_CONNECT_TIMEOUT_MS=15000
```

## CLI Commands & Flags

> **Security Note**: We strongly recommend using a database user with **read-only** permissions (SELECT) when performing introspection and export operations. This minimizes the risk of accidental data modifications. The DbUtility library only executes metadata queries (database structure) and blocks commands that could modify data or read business table rows.

### Global Options

| Flag            | Description                                         |
| --------------- | --------------------------------------------------- |
| `--init`        | Initialize configuration file                       |
| `-f, --force`   | Force recreation of configuration file if it exists |
| `-v, --version` | Output the version number                           |
| `-h, --help`    | Display help for command                            |

### Connection Options (Available for `connect`, `introspect`, `models`, `migrations`)

| Flag                        | Description                                   |
| --------------------------- | --------------------------------------------- |
| `--conn <name>`             | Connection name defined in configuration file |
| `-c, --config <path>`       | Path to configuration file                    |
| `-t, --type <type>`         | Database type (`mysql`, `postgres`, `mssql`)  |
| `-H, --host <host>`         | Database host                                 |
| `-P, --port <port>`         | Database port                                 |
| `-u, --username <username>` | Database username                             |
| `-p, --password <password>` | Database password                             |
| `-d, --database <database>` | Database name                                 |
| `--ssl`                     | Enable SSL connection                         |
| `--connect-timeout <ms>`    | Connection timeout (ms)                       |

### Commands

#### `connect`

Test database connection.

```bash
dbutility connect [connection-options]
```

#### `introspect`

Introspect database schema.

Displays warnings in the terminal when the schema contains tables with more than 32 columns or indexes with more than 32 key columns. The complete details are also saved in the generated `metadata.json`.

```bash
dbutility introspect [connection-options]
```

#### `models`

Export models for target ORM.

When the source schema contains wide tables or oversized index key lists, the CLI prints warnings before generating the files so you can review those cases early.

```bash
dbutility models --target <orm> [options] [connection-options]
```

| Flag                | Description                                               | Required |
| ------------------- | --------------------------------------------------------- | -------- |
| `--target <target>` | Target ORM (`sequelize`, `typeorm`, `prisma`, `mongoose`) | Yes      |
| `--output <dir>`    | Output directory                                          | No       |
| `--test`            | Run tests on generated models                             | No       |

#### `migrations`

Generate migrations from database schema.

When the source schema contains wide tables or oversized index key lists, the CLI prints warnings before generating the files so you can review those cases early.

```bash
dbutility migrations --target <orm> [options] [connection-options]
```

| Flag                | Description                                                          | Required                                             |
| ------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| `--target <target>` | Target ORM (`sequelize`, `typeorm`)                                  | Yes                                                  |
| `--output <dir>`    | Output directory                                                     | No                                                   |
| `--data`            | Generate data migration (seeds) along with schema (Overrides config) | No                                                   |
| `--only-data`       | Generate ONLY data migrations                                        | No                                                   |
| `--backup`          | Export a database backup after the automatic migration test run      | No                                                   |
| `--disable-foreign-keys` | Disable generation of foreign key migration files (`add-fks-*`) | No                                                   |
| `--tables <tables>` | Comma-separated list of tables for data export (Overrides config)    | Yes (if `--data` or `--only-data` and not in config) |
| `--test`            | Run test command after migration generation                          | No                                                   |

Priority for `disableForeignKeys`: CLI flag `--disable-foreign-keys` > `dbutility.config.json` > `.env`. Default: `false`.
Priority for `backup`: CLI flag `--backup` > `dbutility.config.json` > `.env`. Default: `false`.
When `backup` is enabled by CLI flag, configuration file, or environment variable, the migration command automatically runs tests even without `--test`.

#### `test`

Test generated migrations in Docker containers.

```bash
dbutility test --target <orm> [options]
```

| Flag                  | Description                                                         | Required |
| --------------------- | ------------------------------------------------------------------- | -------- |
| `--target <target>`   | Target ORM (`sequelize`, `typeorm`)                                 | Yes      |
| `--dir <dir>`         | Directory containing migrations                                     | No       |
| `--engines <engines>` | Docker images to test (e.g., `postgres:14,mysql:8`)                 | No       |
| `--backup`            | Export database backup from container after test (Overrides config) | No       |

## Usage Examples

### Connect to a database using a named connection

```bash
dbutility connect --conn production
```

### Introspect a database using inline connection parameters

```bash
dbutility introspect --type postgres --host localhost --username myuser --password mypass --database mydb
```

### Export Sequelize models from a specific connection

```bash
dbutility models --target sequelize --conn development --output ./src/models
```

### Export models and run tests

```bash
dbutility models --target sequelize --conn development --test
```

### Generate TypeORM migrations from a specific connection

```bash
dbutility migrations --target typeorm --conn production
```

### Generate Data Migrations (Seeds)

```bash
dbutility migrations --target sequelize --conn development --data --tables "users,roles"
```

## License

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

See [LICENSE](./LICENSE) for more information.

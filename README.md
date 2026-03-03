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
- **Model Export**: Export database tables to Sequelize, TypeORM, and Prisma models (Coming soon).
- **Migration Generation**: Create migrations from existing database tables for Sequelize, TypeORM, and Prisma (Coming soon).

## Installation

```bash
npm install @codemastersolutions/db-utility
# or globally
npm install -g @codemastersolutions/db-utility
```

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
    "dataTables": ["users", { "table": "bsistemas", "where": "id > 15" }],
    "backup": true
  },
  "connection": {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "myuser",
    "password": "mypassword",
    "database": "mydb",
    "ssl": false
  },
  "connections": {
    "development": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "username": "root",
      "password": "password",
      "database": "dev_db"
    },
    "production": {
      "type": "postgres",
      "host": "prod-db",
      "port": 5432,
      "username": "admin",
      "password": "secure_password",
      "database": "prod_db",
      "ssl": true
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

# Database Connection (Fallback/Base)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=mydb
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

### Commands

#### `connect`

Test database connection.

```bash
dbutility connect [connection-options]
```

#### `introspect`

Introspect database schema.

```bash
dbutility introspect [connection-options]
```

#### `models`

Export models for target ORM.

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

```bash
dbutility migrations --target <orm> [options] [connection-options]
```

| Flag                | Description                                                          | Required                                             |
| ------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| `--target <target>` | Target ORM (`sequelize`, `typeorm`)                                  | Yes                                                  |
| `--output <dir>`    | Output directory                                                     | No                                                   |
| `--data`            | Generate data migration (seeds) along with schema (Overrides config) | No                                                   |
| `--only-data`       | Generate ONLY data migrations                                        | No                                                   |
| `--tables <tables>` | Comma-separated list of tables for data export (Overrides config)    | Yes (if `--data` or `--only-data` and not in config) |
| `--test`            | Run test command after migration generation                          | No                                                   |

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

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

The `introspection.outputDir` and `migrations.outputDir` fields accept both relative and absolute paths.

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
    "disableForeignKeys": false,
    "disableTableExistsCheck": false,
    "exportOnlyInDataTables": false,
    "testDatabase": "2019"
  },
  "connection": {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "myuser",
    "password": "mypassword",
    "database": "mydb",
    "ssl": false,
    "connectTimeoutMs": 15000,
    "encrypted": false
  },
  "connections": {
    "development": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "username": "root",
      "password": "password",
      "database": "dev_db",
      "connectTimeoutMs": 15000,
      "encrypted": false
    },
    "production": {
      "type": "postgres",
      "host": "prod-db",
      "port": 5432,
      "username": "admin",
      "password": "secure_password",
      "database": "prod_db",
      "ssl": true,
      "connectTimeoutMs": 15000,
      "encrypted": false
    }
  }
}
```

> **Encrypted Connection Credentials**: To avoid storing plaintext secrets in `dbutility.config.json`, set `"encrypted": true` on each connection and replace the `host`, `port`, `username`, `password`, and `database` values with the outputs produced by `dbutility encrypt "<plaintext>"`. The encryption key must be provided via the `DBUTILITY_ENCRYPTION_KEY` environment variable. The library automatically decrypts the values before connecting to the database.

**Step-by-step: Encrypted Connection Credentials**

1. **Generate a strong encryption key** and store it in your `.env` file or system environment variables. You can use any cryptographically strong random value (at least 32 characters):
   ```bash
   openssl rand -hex 32
   ```
2. **Add the key** to the environment (`.env` file for the project is the recommended place):
   ```env
   DBUTILITY_ENCRYPTION_KEY="your-random-64-char-value-from-step-1"
   ```
   The library also accepts aliases: `DB_UTILITY_ENCRYPTION_KEY`, `DBUTILITY_CRYPTO_KEY`, or `DB_UTILITY_CRYPTO_KEY`.
3. **Encrypt each of the 5 sensitive fields** with the CLI:
   ```bash
   dbutility encrypt "prod-db.internal.example"     # host
   dbutility encrypt "1433"                          # port (as a string, it is encrypted and later parsed back to integer)
   dbutility encrypt "app_user"                      # username
   dbutility encrypt "StrongP@ssW0rd!123"            # password
   dbutility encrypt "production_db"                 # database
   ```
4. **Replace the plain values** in `dbutility.config.json` with the encrypted strings and mark the connection:
   ```json
   {
     "connection": {
       "type": "postgres",
       "host": "<encrypted-host>",
       "port": "<encrypted-port>",
       "username": "<encrypted-username>",
       "password": "<encrypted-password>",
       "database": "<encrypted-database>",
       "ssl": true,
       "connectTimeoutMs": 15000,
       "encrypted": true
     }
   }
   ```
5. **Important notes**:
   - Only these 5 fields are encrypted: `host`, `port`, `username`, `password`, `database`.
   - NEVER encrypt `type`, `ssl`, `connectTimeoutMs`, or `encrypted` itself; keep them as plain values.
   - The same `DBUTILITY_ENCRYPTION_KEY` must be present in every environment where DbUtility runs (developer laptops, CI/CD, deployment servers).
   - If you lose the encryption key, there is no way to recover the encrypted values; treat the key with the same level of care as any other secret.
   - The encrypted `port` is stored as a cipher string; after decryption it is parsed back to an integer automatically.

The `migrations` property accepts either a single object or an array of objects. When it is an array, the `migrations` command runs the process for each item in the declared order.

You can also define `connectionName` on each migration item to use a specific connection from the `connections` object. When `connectionName` is omitted, the migration uses the default connection from `connection`. If the provided name does not exist in `connections`, that migration item is skipped and a warning is shown to the user.

```json
{
  "target": "sequelize",
  "migrations": [
    {
      "outputDir": "exports/migrations/tenant-a",
      "fileNamePattern": "timestamp-prefix",
      "connectionName": "tenantA",
      "disableForeignKeys": true,
      "disableTableExistsCheck": true,
      "exportOnlyInDataTables": true,
      "dataTables": ["users", "roles"],
      "testDatabase": {
        "registry": "mcr.microsoft.com/mssql",
        "image": "server:2019-latest"
      }
    },
    {
      "outputDir": "exports/migrations/tenant-b",
      "fileNamePattern": "timestamp-prefix",
      "connectionName": "tenantB",
      "data": true,
      "dataTables": ["users", "roles"]
    }
  ],
  "connection": {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "default_user",
    "password": "secret",
    "database": "default_db"
  },
  "connections": {
    "tenantA": {
      "type": "postgres",
      "host": "localhost",
      "port": 5432,
      "username": "tenant_a_user",
      "password": "secret",
      "database": "tenant_a_db"
    },
    "tenantB": {
      "type": "postgres",
      "host": "localhost",
      "port": 5432,
      "username": "tenant_b_user",
      "password": "secret",
      "database": "tenant_b_db"
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

### Existing Table Guard Configuration

By default, generated create-table migrations check whether the target table already exists before calling `createTable`. If the table already exists, the migration prints a message to the terminal and returns success so execution can continue without interruption. This prevents failures caused by tables that were manually created before the migrations run.

On **Sequelize 5.x** (where `queryInterface.tableExists` is not available), the generated migration falls back to `queryInterface.describeTable` and treats a "table does not exist" error as a non-existent table, so the guard works across both Sequelize 5 and Sequelize 6 transparently.

Set `migrations.disableTableExistsCheck` to `true` to disable this guard. The default value is `false`. Use this when you want a hard failure if a create-table migration runs against an already-existing schema object.

```json
{
  "migrations": {
    "disableTableExistsCheck": true
  }
}
```

### Isolated Migration Export Configuration

Set `migrations.exportOnlyInDataTables` to `true` to generate schema migrations only for the tables declared in `migrations.dataTables` from the configuration file. The default value is `false`.

When this option is enabled:

- only the tables listed in `migrations.dataTables` are exported as schema migrations;
- `disableForeignKeys` is automatically treated as `true`;
- the generated tables work in isolation, without foreign key migrations depending on other tables.
- `dataTables` must be defined in the same migration config item.

This option is available only in the configuration file.

```json
{
  "migrations": {
    "dataTables": ["users", "roles"],
    "exportOnlyInDataTables": true
  }
}
```

### Migration Test Database Configuration

Set `migrations.testDatabase` in the configuration file when you want migration tests to run against a specific database version or Docker image. This option is optional and is available only in the configuration file.

You can provide only a version string, and the library keeps the database type detected by introspection:

```json
{
  "migrations": {
    "testDatabase": "2019"
  }
}
```

With version-only values such as `2019`, `8`, or `18.4`, DbUtility:

- keeps the database type detected in `database-info.json`;
- resolves the most recent available tag that matches the informed version pattern;
- progressively removes version blocks when necessary until it finds an available image;
- interrupts the test process with an error message if no matching Docker image is found.

You can also provide an explicit image as a string:

```json
{
  "migrations": {
    "testDatabase": "postgres:18.4"
  }
}
```

String images use Docker Hub by default.

You can also provide an object:

```json
{
  "migrations": {
    "testDatabase": {
      "registry": "mcr.microsoft.com/mssql",
      "image": "server:2019-latest"
    }
  }
}
```

Supported object formats:

- `{ "registry": "dhi.io", "image": "node:26-alpine-sfw-ent-dev" }`
- `{ "registry": "mcr.microsoft.com/mssql", "image": "server:2019-latest" }`
- `{ "image": "mcr.microsoft.com/mssql/server:2019-latest" }`

When the object does not include `registry`, DbUtility first tries the full value from `image`. If no image is found, it retries using Docker Hub. If it still cannot find a valid image, the test process is interrupted with an error message.

**Practical Version Mapping**

| `testDatabase` value | DB type (from introspection) | Resolved Docker image example                |
| -------------------- | ---------------------------- | -------------------------------------------- |
| `"2019"`             | MSSQL                        | `mcr.microsoft.com/mssql/server:2019-latest` |
| `"2016"`             | MSSQL                        | `mcr.microsoft.com/mssql/server:2016-latest` |
| `"8"`                | MySQL                        | `mysql:8.<latest-minor>.<latest-patch>`      |
| `"5.7"`              | MySQL                        | `mysql:5.7.<latest-patch>`                   |
| `"18.4"`             | PostgreSQL                   | `postgres:18.4`                              |
| `"16"`               | PostgreSQL                   | `postgres:16-alpine` or latest tag           |

For version-only strings like `"8"`, DbUtility progressively resolves the most recent available tag (`8.x.y`, falling back to `8.x`, then `8`, stopping at the first existing image that Docker Hub returns. Private registries require the image to be already accessible from the local Docker daemon (run `docker login <registry>` beforehand).

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

# Disable the default existing-table guard in create-table migrations (true/false)
DB_UTILITY_MIGRATIONS_DISABLE_TABLE_EXISTS_CHECK=true

# Database Connection (Fallback/Base)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=mydb
DB_CONNECT_TIMEOUT_MS=15000

# Encryption Key used to decrypt DB connection fields (host, port, username, password, database)
# when "encrypted": true is set in the config or DBUTILITY_DB_ENCRYPTED=true.
DBUTILITY_ENCRYPTION_KEY="replace-with-a-strong-random-secret"

# When true, the DB_* connection values are expected to be encrypted via the key above.
# DBUTILITY_DB_ENCRYPTED=true
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

#### `encrypt` / `decrypt`

Encrypts (or decrypts) a single value using the key configured via `DBUTILITY_ENCRYPTION_KEY`. Use the encrypted outputs with `encrypted: true` in the connection configuration.

```bash
# Encrypt connection secrets one by one:
dbutility encrypt "db.example.internal"
dbutility encrypt "1433"
dbutility encrypt "sa"
dbutility encrypt "MyStr0ng!P@ss"
dbutility encrypt "app_production"

# Decrypt a previously encrypted value for debugging:
dbutility decrypt "<encrypted-value>"
```

> **Default Behavior**: By default, credentials are stored in plaintext in the config file. To enable encrypted fields, use `dbutility encrypt` for each sensitive value, place the resulting strings in place of the plaintext values, and set `"encrypted": true` on the connection (or `DBUTILITY_DB_ENCRYPTED=true`). Remember to provide the same `DBUTILITY_ENCRYPTION_KEY` that was used during encryption. To disable the built-in credential encryption feature, simply keep or set `"encrypted": false` on your connection(s).

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

| Flag                           | Description                                                          | Required                                             |
| ------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------- |
| `--target <target>`            | Target ORM (`sequelize`, `typeorm`)                                  | Yes                                                  |
| `--output <dir>`               | Output directory                                                     | No                                                   |
| `--data`                       | Generate data migration (seeds) along with schema (Overrides config) | No                                                   |
| `--only-data`                  | Generate ONLY data migrations                                        | No                                                   |
| `--backup`                     | Export a database backup after the automatic migration test run      | No                                                   |
| `--disable-foreign-keys`       | Disable generation of foreign key migration files (`add-fks-*`)      | No                                                   |
| `--disable-table-exists-check` | Disable the default existing-table guard in create-table migrations  | No                                                   |
| `--tables <tables>`            | Comma-separated list of tables for data export (Overrides config)    | Yes (if `--data` or `--only-data` and not in config) |
| `--test`                       | Run test command after migration generation                          | No                                                   |

Priority for `disableForeignKeys`: CLI flag `--disable-foreign-keys` > `dbutility.config.json` > `.env`. Default: `false`.
Priority for `disableTableExistsCheck`: CLI flag `--disable-table-exists-check` > `dbutility.config.json` > `.env`. Default: `false`.
Priority for `backup`: CLI flag `--backup` > `dbutility.config.json` > `.env`. Default: `false`.
When `backup` is enabled by CLI flag, configuration file, or environment variable, the migration command automatically runs tests even without `--test`.
By default, create-table migrations include an existing-table guard. Use `--disable-table-exists-check`, `migrations.disableTableExistsCheck`, or `DB_UTILITY_MIGRATIONS_DISABLE_TABLE_EXISTS_CHECK=true` to turn it off.
`migrations.testDatabase` is available only in the configuration file and is used when the test engine is inferred from `database-info.json`.

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

When `--engines` is not provided, the `test` command also honors `migrations.testDatabase` from the configuration file.

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

### End-to-End: Encrypted credentials for a production connection

1. Generate the key and put it in `.env`:
   ```bash
   openssl rand -hex 32 > /tmp/dbkey
   # copy output into .env as DBUTILITY_ENCRYPTION_KEY=...
   ```
2. Encrypt the 5 connection values:
   ```bash
   export DBUTILITY_ENCRYPTION_KEY=$(cat /tmp/dbkey)
   dbutility encrypt "prod-db.company.internal"
   dbutility encrypt "5432"
   dbutility encrypt "app_prod"
   dbutility encrypt "xxxxxxxxxxxxxxxx"
   dbutility encrypt "app_production"
   ```
3. Paste outputs into `dbutility.config.json` and mark the connection with `"encrypted": true`.
4. Verify the connection without exposing plaintext:
   ```bash
   dbutility connect --conn production
   ```

### Generate isolated migrations for just two catalog/lookup tables (isolated migrations for a second database

When you need to export only two lookup tables such as `status` and `roles` independently of the rest of the schema, declare them in `migrations.dataTables` and enable the isolated-flag:

```json
{
  "migrations": {
    "outputDir": "exports/migrations/lookups",
    "exportOnlyInDataTables": true,
    "dataTables": ["status", "roles"],
    "disableTableExistsCheck": false
  }
}
```

```bash
dbutility migrations --target sequelize --conn development
```

This produces schema migrations **only** for `status` and `roles`, with `disableForeignKeys` is automatically `true`, so there are no `add-fks-*` files and the resulting migrations work stand alone against any compatible database.

### Generate migrations and test them against a specific SQL Server version

If your production cluster is still on SQL Server 2016 but you want migrations to be validated for a newer 2019 target:

```json
{
  "migrations": {
    "backup": true,
    "testDatabase": "2019"
  }
}
```

```bash
dbutility migrations --target sequelize --conn production
```

The type of database (MSSQL) is detected from `database-info.json`, and the test runner spins up `mcr.microsoft.com/mssql/server:2019-latest` for the validation.

### Disable the default create-table existence guard (force hard-fail behavior

For CI pipelines that want fail when tables already exist, disable the default guard:

```bash
dbutility migrations --target typeorm --conn staging --disable-table-exists-check
```

or configure it in the configuration file:

```json
{
  "migrations": {
    "disableTableExistsCheck": true
  }
}
```

## License

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

See [LICENSE](./LICENSE) for more information.

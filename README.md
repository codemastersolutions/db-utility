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
  "introspection": {
    "outputDir": "db-utility-introspect"
  },
  "migrations": {
    "outputDir": "db-utility-migrations",
    "fileNamePattern": "timestamp-prefix"
  },
  "connection": {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "myuser",
    "password": "mypassword",
    "database": "mydb",
    "ssl": false
  }
}
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

# Database Connection (Fallback/Base)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=mydb
```

## CLI - Command Line Interface

> **Security Note**: We strongly recommend using a database user with **read-only** permissions (SELECT) when performing introspection and export operations. This minimizes the risk of accidental data modifications. The DbUtility library only executes metadata queries (database structure) and blocks commands that could modify data or read business table rows.

DbUtility offers a robust CLI to interact with your databases.

### Connect to Database

Test connection to your database.

```bash
dbutility connect -t postgres -H localhost -P 5432 -u username -p password -d database_name --ssl
```

### Perform Introspection

Analyze database schema and generate introspection reports.

```bash
dbutility introspect -t mysql -H localhost -P 3306 -u username -p password -d database_name
```

### Export Models

Export database structure to ORM models.

```bash
dbutility export --target sequelize --output ./src/models -t postgres ...
```

### Generate Migrations

Generate migrations from existing database structure. This command cleans the output directory before generating new files.

```bash
dbutility migrate --target sequelize --output ./migrations -t postgres ...
```

Options:
- `--data`: Generate data migrations (seeds) for specified tables.
- `--only-data`: Generate ONLY data migrations (seeds).
- `--tables <tables>`: Comma-separated list of tables to export data from.

When using `--data`, seed files are generated immediately after their corresponding table creation migration.

### Test Migrations

Test generated migrations using Docker containers.

```bash
dbutility test --target sequelize --dir ./migrations/sequelize --engines postgres:14
```

Options:
- `--target <target>`: Target ORM (sequelize, typeorm).
- `--dir <dir>`: Directory containing migrations (optional).
- `--engines <engines>`: Comma-separated list of database engines to test (e.g., postgres:14, mysql:8). If omitted, it tries to read `database-info.json` generated by the migrate command.

Requirements:
- Docker must be installed and running.

### CLI Options

- `-t, --type <type>`: Database type (postgres, mysql, mssql)
- `-H, --host <host>`: Database host
- `-P, --port <port>`: Database port
- `-u, --username <username>`: Database username
- `-p, --password <password>`: Database password
- `-d, --database <database>`: Database name
- `--ssl`: Enable SSL (optional)
- `-c, --config <path>`: Path to a specific configuration file

## License

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

See [LICENSE](./LICENSE) for more information.

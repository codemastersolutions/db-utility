# DbUtility

> The most powerful database utility.

[![npm version](https://img.shields.io/npm/v/@codemastersolutions/db-utility.svg)](https://www.npmjs.com/package/@codemastersolutions/db-utility)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[🇧🇷 Português](./README.pt-BR.md) | [🇪🇸 Español](./README.es.md)**

DbUtility is a powerful utility for manipulating Microsoft SQL Server, MySQL, and PostgreSQL databases. Developed in Node.js and TypeScript, it aims to simplify database connection, introspection, model export, and migration creation.

## Features

- **Multi-Database Support**: Connect to Microsoft SQL Server, MySQL, and PostgreSQL using official drivers (`mssql`, `mysql2`, `pg`).
- **Flexible Configuration**: Connection details via `.env`, JavaScript, or JSON configuration files.
- **Introspection**: Analyze your database to list tables, views, stored procedures, functions, and triggers.
- **Model Export**: Export database tables to Sequelize, TypeORM, and Prisma models.
- **Migration Generation**: Create migrations from existing database tables for Sequelize, TypeORM, and Prisma, handling constraints, indexes, and data types correctly.

## Installation

```bash
npm install @codemastersolutions/db-utility
```

## Usage

```typescript
import { DbUtility } from '@codemastersolutions/db-utility';

// Example usage
```

## License

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

See [LICENSE](./LICENSE) for more information.

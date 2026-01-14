# DbUtility

> La utilidad de base de datos más potente.

[![npm version](https://img.shields.io/npm/v/@codemastersolutions/db-utility.svg)](https://www.npmjs.com/package/@codemastersolutions/db-utility)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[🇺🇸 English](./README.md) | [🇧🇷 Português](./README.pt-BR.md)**

DbUtility es una potente utilidad para manipular bases de datos Microsoft SQL Server, MySQL y PostgreSQL. Desarrollado en Node.js y TypeScript, tiene como objetivo simplificar la conexión a la base de datos, la introspección, la exportación de modelos y la creación de migraciones.

## Características

- **Soporte Multi-Base de Datos**: Conéctese a Microsoft SQL Server, MySQL y PostgreSQL utilizando controladores oficiales (`mssql`, `mysql2`, `pg`).
- **Configuración Flexible**: Detalles de conexión a través de `.env`, archivos de configuración JavaScript o JSON.
- **Introspección**: Analice su base de datos para listar tablas, vistas, procedimientos almacenados, funciones y disparadores.
- **Exportación de Modelos**: Exporte tablas de base de datos a modelos de Sequelize, TypeORM y Prisma.
- **Generación de Migraciones**: Cree migraciones a partir de tablas existentes en la base de datos para Sequelize, TypeORM y Prisma, manejando restricciones, índices y tipos de datos correctamente.

## Instalación

```bash
npm install @codemastersolutions/db-utility
```

## Uso

```typescript
import { DbUtility } from '@codemastersolutions/db-utility';

// Ejemplo de uso
```

## Licencia

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

Vea [LICENSE.es](./LICENSE.es) para más información.

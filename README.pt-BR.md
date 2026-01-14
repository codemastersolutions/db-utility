# DbUtility

> O mais poderoso utilitário de banco de dados.

[![npm version](https://img.shields.io/npm/v/@codemastersolutions/db-utility.svg)](https://www.npmjs.com/package/@codemastersolutions/db-utility)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[🇺🇸 English](./README.md) | [🇪🇸 Español](./README.es.md)**

DbUtility é um utilitário poderoso para manipulação de bancos de dados Microsoft SQL Server, MySQL e PostgreSQL. Desenvolvido em Node.js e TypeScript, visa simplificar a conexão com banco de dados, introspecção, exportação de models e criação de migrations.

## Funcionalidades

- **Suporte Multi-Banco**: Conecte-se ao Microsoft SQL Server, MySQL e PostgreSQL usando drivers oficiais (`mssql`, `mysql2`, `pg`).
- **Configuração Flexível**: Detalhes de conexão via `.env`, arquivos de configuração JavaScript ou JSON.
- **Introspecção**: Analise seu banco de dados para listar tabelas, views, stored procedures, funções e triggers.
- **Exportação de Models**: Exporte tabelas do banco de dados para models do Sequelize, TypeORM e Prisma.
- **Geração de Migrations**: Crie migrations a partir de tabelas existentes no banco de dados para Sequelize, TypeORM e Prisma, tratando constraints, indexes e tipos de dados corretamente.

## Instalação

```bash
npm install @codemastersolutions/db-utility
```

## Uso

```typescript
import { DbUtility } from '@codemastersolutions/db-utility';

// Exemplo de uso
```

## Licença

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

Veja [LICENSE.pt-BR](./LICENSE.pt-BR) para mais informações.

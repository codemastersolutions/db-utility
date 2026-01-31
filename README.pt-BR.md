# DbUtility

> O mais poderoso utilitário de banco de dados.

[![npm version](https://img.shields.io/npm/v/@codemastersolutions/db-utility.svg)](https://www.npmjs.com/package/@codemastersolutions/db-utility)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[🇺🇸 English](./README.md) | [🇪🇸 Español](./README.es.md)**

DbUtility é um utilitário poderoso para manipulação de bancos de dados Microsoft SQL Server, MySQL e PostgreSQL. Desenvolvido em Node.js e TypeScript, visa simplificar a conexão com banco de dados, introspecção, exportação de models e criação de migrations.

## Funcionalidades

- **Suporte Multi-Banco**: Conecte-se ao Microsoft SQL Server, MySQL e PostgreSQL usando drivers oficiais (`mssql`, `mysql2`, `pg`).
- **Configuração Flexível**: Detalhes de conexão via CLI, `.env`, arquivos de configuração JSON.
- **Introspecção**: Analise seu banco de dados para listar tabelas, views, stored procedures, funções e triggers.
- **Exportação de Models**: Exporte tabelas do banco de dados para models do Sequelize, TypeORM e Prisma (Em breve).
- **Geração de Migrations**: Crie migrations a partir de tabelas existentes no banco de dados para Sequelize, TypeORM e Prisma (Em breve).

## Instalação

```bash
npm install @codemastersolutions/db-utility
# ou globalmente
npm install -g @codemastersolutions/db-utility
```

## Configuração

### Inicialização

Você pode inicializar um arquivo de configuração padrão usando o comando CLI:

```bash
dbutility --init
```

Se o arquivo já existir, você pode forçar a recriação com os valores padrão:

```bash
dbutility --init -f
# ou
dbutility --init --force
```

### Arquivo de Configuração (dbutility.config.json)

O arquivo de configuração permite definir o idioma da CLI, diretórios de saída, padrões de nomenclatura e configurações de conexão com o banco de dados.

```json
{
  "language": "pt-BR",
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
    "username": "usuario",
    "password": "senha",
    "database": "meubanco",
    "ssl": false
  }
}
```

### Prioridade de Configuração

A configuração é carregada com a seguinte ordem de prioridade (prioridade mais alta sobrescreve a mais baixa):

1. **Flags da CLI**: Argumentos passados diretamente para o comando (ex: `-u usuario`).
2. **Arquivo de Configuração**: Configurações no `dbutility.config.json`.
3. **Variáveis de Ambiente**: Variáveis definidas no `.env`.

Isso permite ter configurações base no `.env`, configurações específicas do projeto no `dbutility.config.json` e sobrescrever valores específicos (como senha) via CLI quando necessário.

### Variáveis de Ambiente (.env)

Você também pode configurar o DbUtility usando variáveis de ambiente.

```env
# Idioma (pt-BR, en, es)
DB_UTILITY_LANG=pt-BR

# Diretórios de Saída
DB_UTILITY_INTROSPECTION_OUTPUT_DIR=meu-diretorio-introspect
DB_UTILITY_MIGRATIONS_OUTPUT_DIR=meu-diretorio-migrations

# Padrão de Nome de Arquivo de Migration (timestamp-prefix, prefix-timestamp)
DB_UTILITY_MIGRATIONS_FILE_NAME_PATTERN=prefix-timestamp

# Conexão com Banco de Dados (Fallback/Base)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=usuario
DB_PASSWORD=senha
DB_NAME=meubanco
```

## CLI - Interface de Linha de Comando

> **Nota de Segurança**: Recomendamos fortemente o uso de um usuário de banco de dados com permissões de **somente leitura** (SELECT) para realizar operações de introspecção e exportação. Isso minimiza riscos de alterações acidentais nos dados. A biblioteca DbUtility executa apenas consultas de metadados (estrutura do banco) e bloqueia comandos que possam alterar dados ou ler registros das tabelas de negócio.

O DbUtility oferece uma CLI robusta para interagir com seus bancos de dados.

### Conectar ao Banco de Dados

Teste a conexão com seu banco de dados.

```bash
dbutility connect -t postgres -H localhost -P 5432 -u usuario -p senha -d banco_dados --ssl
```

### Realizar Introspecção

Analise o esquema do banco de dados e gere relatórios de introspecção.

```bash
dbutility introspect -t mysql -H localhost -P 3306 -u usuario -p senha -d banco_dados
```

### Exportar Models

Exporte a estrutura do banco de dados para models de ORM.

```bash
dbutility export --target sequelize --output ./src/models -t postgres ...
```

### Gerar Migrations

Gere migrations a partir da estrutura existente do banco de dados. Este comando limpa o diretório de saída antes de gerar novos arquivos.

```bash
dbutility migrate --target sequelize --output ./migrations -t postgres ...
```

Opções:
- `--data`: Gera migrations de dados (seeds) para as tabelas especificadas.
- `--only-data`: Gera APENAS migrations de dados (seeds).
- `--tables <tables>`: Lista de tabelas separadas por vírgula para exportar dados.

Ao usar `--data`, os arquivos de seed são gerados imediatamente após a migration de criação da tabela correspondente.

### Testar Migrations

Teste as migrations geradas usando containers Docker.

```bash
dbutility test --target sequelize --dir ./migrations/sequelize --engines postgres:14
```

Opções:
- `--target <target>`: ORM alvo (sequelize, typeorm).
- `--dir <dir>`: Diretório contendo as migrations (opcional).
- `--engines <engines>`: Lista separada por vírgula de engines de banco de dados para testar (ex: postgres:14, mysql:8). Se omitido, tenta ler `database-info.json` gerado pelo comando migrate.

Requisitos:
- Docker deve estar instalado e em execução.

### Opções da CLI

- `-t, --type <type>`: Tipo de banco de dados (postgres, mysql, mssql)
- `-H, --host <host>`: Host do banco de dados
- `-P, --port <port>`: Porta do banco de dados
- `-u, --username <username>`: Usuário do banco de dados
- `-p, --password <password>`: Senha do banco de dados
- `-d, --database <database>`: Nome do banco de dados
- `--ssl`: Habilitar SSL (opcional)
- `-c, --config <path>`: Caminho para um arquivo de configuração específico

## Licença

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

Veja [LICENSE.pt-BR](./LICENSE.pt-BR) para mais informações.

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
- **Exportação de Models**: Exporte tabelas do banco de dados para models do Sequelize, TypeORM, Prisma e Mongoose.
- **Geração de Migrations**: Crie migrations de esquema e dados a partir de tabelas existentes no banco de dados para Sequelize e TypeORM.

## Instalação

```bash
npm install @codemastersolutions/db-utility
# ou globalmente
npm install -g @codemastersolutions/db-utility
```

## Testes de Integração MSSQL

O DbUtility inclui testes de integração opt-in para Microsoft SQL Server que validam os runners reais de migration contra um container Docker.

Atualmente, esses testes cobrem:

- migrations Sequelize com colunas de string longa no MSSQL
- migrations TypeORM com colunas de string longa no MSSQL
- migrations Sequelize que omitem defaults numéricos inválidos em colunas de data/datetimeoffset no MSSQL
- migrations Sequelize que preservam chaves estrangeiras compostas com colunas referenciadas correspondentes
- migrations Sequelize que preservam auto-relacionamentos com chaves estrangeiras compostas
- migrations Sequelize que preservam chaves estrangeiras compostas com `ON DELETE SET NULL`
- migrations TypeORM que preservam tipos de data/datetimeoffset do MSSQL e omitem defaults numéricos inválidos
- inserções reais de valores com mais de 4000 caracteres sem erro de tamanho de parâmetro

Pré-requisitos:

- Docker instalado e disponível no seu `PATH`
- Dependências de desenvolvimento instaladas com `pnpm install`

Scripts disponíveis:

```bash
# Executa as duas suítes de integração MSSQL
pnpm run test:integration:mssql

# Executa apenas as integrações Sequelize + MSSQL
pnpm run test:integration:mssql:sequelize

# Executa apenas a integração TypeORM + MSSQL
pnpm run test:integration:mssql:typeorm
```

Observações:

- Esses scripts ativam automaticamente `DBUTILITY_RUN_DOCKER_INTEGRATION=1`.
- Eles usam `cross-env`, então os mesmos comandos funcionam em macOS, Linux e Windows.
- Eles ficam separados de `pnpm test` para manter a suíte padrão rápida.
- Os testes sobem containers reais do SQL Server e podem demorar mais do que os testes unitários.

## Uso de Internet

Esta biblioteca utiliza sua conexão com a internet para verificar atualizações no registro npm. Esta verificação é realizada automaticamente (padrão: diariamente) quando você executa um comando da CLI.

- **Timeout**: A verificação tem um tempo limite de 10 segundos.
- **Offline**: Se nenhuma conexão com a internet for detectada, a verificação é ignorada silenciosamente.
- **Privacidade**: Nenhum dado pessoal é coletado. Apenas a versão do pacote é comparada.
- **Configuração**: Você pode desativar este recurso ou alterar a frequência no arquivo de configuração.

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
    "dataTables": ["usuarios", { "table": "logs", "where": "nivel = 'ERRO'" }],
    "backup": true,
    "disableForeignKeys": false
  },
  "connection": {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "usuario",
    "password": "senha",
    "database": "meubanco",
    "ssl": false,
    "connectTimeoutMs": 15000
  },
  "connections": {
    "desenvolvimento": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "username": "root",
      "password": "password",
      "database": "dev_db",
      "connectTimeoutMs": 15000
    },
    "producao": {
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

### Configuração de Verificação de Versão

Você pode configurar a verificação automática de versão no `dbutility.config.json`.

```json
{
  "versionCheck": {
    "enabled": true,
    "frequency": "daily"
  }
}
```

- **`enabled`** (boolean): Defina como `true` para ativar a verificação de versão, `false` para desativar. Padrão: `true`.
- **`frequency`** (string): Com que frequência verificar atualizações.
  - `"daily"`: Uma vez por dia (padrão).
  - `"weekly"`: Uma vez por semana.
  - `"monthly"`: Uma vez por mês.

### Configuração Avançada de Extração de Dados

A opção `dataTables` permite especificar quais tabelas devem ter seus dados exportados (para seeds). Você pode fornecer uma lista simples de nomes de tabelas ou um objeto com uma cláusula `where` para filtrar os dados.

```json
"dataTables": [
  "cargos",
  "permissoes",
  {
    "table": "usuarios",
    "where": "ativo = 1 AND criado_em > '2023-01-01'",
    "disableIdentity": true
  },
  {
    "table": "bsistemas",
    "where": "id > 15"
  }
]
```

A opção `disableIdentity` (padrão: `false`) permite inserir valores explícitos em colunas auto-increment/identity. Isso é útil quando você deseja preservar os IDs originais do banco de origem.

- **MSSQL**: Envolve as inserções com `SET IDENTITY_INSERT [Table] ON/OFF`.
- **PostgreSQL**: Reseta o valor da sequence após a inserção usando `setval` para evitar falhas em inserções subsequentes.
- **Outros Bancos (MySQL, SQLite)**: Inclui a coluna identity no payload de inserção (geralmente atualizam o contador de auto-incremento automaticamente).

### Configuração de Migrations de Foreign Keys

Defina `migrations.disableForeignKeys` como `true` para não gerar arquivos de migration `add-fks-*`. O valor padrão é `false`.

```json
{
  "migrations": {
    "disableForeignKeys": true
  }
}
```

### Múltiplas Conexões

Você pode definir múltiplas conexões dentro da propriedade `connections` e utilizá-las na CLI com a flag `--conn <nome>`.

Exemplo:

```bash
dbutility connect --conn desenvolvimento
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

# Dados de Migração (true/false)
DB_UTILITY_MIGRATIONS_DATA=true

# Tabelas de Dados para Migração (Separadas por vírgula)
DB_UTILITY_MIGRATIONS_DATA_TABLES=usuarios,cargos

# Backup de Migração (true/false)
DB_UTILITY_MIGRATIONS_BACKUP=true

# Desabilita a geração de migrations de foreign keys (true/false)
DB_UTILITY_MIGRATIONS_DISABLE_FOREIGN_KEYS=true

# Conexão com Banco de Dados (Fallback/Base)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=usuario
DB_PASSWORD=senha
DB_NAME=meubanco
DB_CONNECT_TIMEOUT_MS=15000
```

## Comandos e Flags da CLI

> **Nota de Segurança**: Recomendamos fortemente o uso de um usuário de banco de dados com permissões de **somente leitura** (SELECT) para realizar operações de introspecção e exportação. Isso minimiza riscos de alterações acidentais nos dados. A biblioteca DbUtility executa apenas consultas de metadados (estrutura do banco) e bloqueia comandos que possam alterar dados ou ler registros das tabelas de negócio.

### Opções Globais

| Flag            | Descrição                                                  |
| --------------- | ---------------------------------------------------------- |
| `--init`        | Inicializa o arquivo de configuração                       |
| `-f, --force`   | Força a recriação do arquivo de configuração se já existir |
| `-v, --version` | Exibe o número da versão                                   |
| `-h, --help`    | Exibe ajuda para o comando                                 |

### Opções de Conexão (Disponíveis para `connect`, `introspect`, `models`, `migrations`)

| Flag                        | Descrição                                             |
| --------------------------- | ----------------------------------------------------- |
| `--conn <name>`             | Nome da conexão definida no arquivo de configuração   |
| `-c, --config <path>`       | Caminho para o arquivo de configuração                |
| `-t, --type <type>`         | Tipo de banco de dados (`mysql`, `postgres`, `mssql`) |
| `-H, --host <host>`         | Host do banco de dados                                |
| `-P, --port <port>`         | Porta do banco de dados                               |
| `-u, --username <username>` | Usuário do banco de dados                             |
| `-p, --password <password>` | Senha do banco de dados                               |
| `-d, --database <database>` | Nome do banco de dados                                |
| `--ssl`                     | Habilita conexão SSL                                  |
| `--connect-timeout <ms>`    | Timeout de conexão (ms)                               |

### Comandos

#### `connect`

Testa a conexão com o banco de dados.

```bash
dbutility connect [opções-conexão]
```

#### `introspect`

Faz introspecção no esquema do banco de dados.

Exibe avisos no terminal quando o schema possui tabelas com mais de 32 colunas ou índices com mais de 32 colunas-chave. Os detalhes completos também ficam salvos no `metadata.json` gerado.

```bash
dbutility introspect [opções-conexão]
```

#### `models`

Exporta modelos para o ORM alvo.

Quando o schema de origem possui tabelas largas ou listas de chaves de índice acima do limite, a CLI exibe avisos antes de gerar os arquivos para facilitar a revisão desses casos.

```bash
dbutility models --target <orm> [opções] [opções-conexão]
```

| Flag                | Descrição                                               | Obrigatório |
| ------------------- | ------------------------------------------------------- | ----------- |
| `--target <target>` | ORM alvo (`sequelize`, `typeorm`, `prisma`, `mongoose`) | Sim         |
| `--output <dir>`    | Diretório de saída                                      | Não         |
| `--test`            | Executa testes nos models gerados                       | Não         |

#### `migrations`

Gera migrações a partir do esquema do banco de dados.

Quando o schema de origem possui tabelas largas ou listas de chaves de índice acima do limite, a CLI exibe avisos antes de gerar os arquivos para facilitar a revisão desses casos.

```bash
dbutility migrations --target <orm> [opções] [opções-conexão]
```

| Flag                | Descrição                                                                                  | Obrigatório                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `--target <target>` | ORM alvo (`sequelize`, `typeorm`)                                                          | Sim                                                              |
| `--output <dir>`    | Diretório de saída                                                                         | Não                                                              |
| `--data`            | Gera migração de dados (seeds) junto com o esquema (Sobrescreve configuração)              | Não                                                              |
| `--only-data`       | Gera APENAS migração de dados                                                              | Não                                                              |
| `--disable-foreign-keys` | Desabilita a geração de arquivos de migration de foreign keys (`add-fks-*`)         | Não                                                              |
| `--tables <tables>` | Lista de tabelas separadas por vírgula para exportação de dados (Sobrescreve configuração) | Sim (se `--data` ou `--only-data` e não estiver na configuração) |
| `--test`            | Executa o comando test após a geração das migrações                                        | Não                                                              |

Prioridade para `disableForeignKeys`: flag `--disable-foreign-keys` > `dbutility.config.json` > `.env`. Padrão: `false`.

#### `test`

Testa migrações geradas em containers Docker.

```bash
dbutility test --target <orm> [opções]
```

| Flag                  | Descrição                                                                             | Obrigatório |
| --------------------- | ------------------------------------------------------------------------------------- | ----------- |
| `--target <target>`   | ORM alvo (`sequelize`, `typeorm`)                                                     | Sim         |
| `--dir <dir>`         | Diretório contendo as migrações                                                       | Não         |
| `--engines <engines>` | Imagens Docker para testar (ex: `postgres:14,mysql:8`)                                | Não         |
| `--backup`            | Exporta backup do banco de dados do container após o teste (Sobrescreve configuração) | Não         |

## Exemplos de Uso

### Conectar a um banco de dados usando uma conexão nomeada

```bash
dbutility connect --conn producao
```

### Fazer introspecção de um banco de dados usando parâmetros de conexão inline

```bash
dbutility introspect --type postgres --host localhost --username usuario --password senha --database meubanco
```

### Exportar modelos do Sequelize de uma conexão específica

```bash
dbutility models --target sequelize --conn desenvolvimento --output ./src/models
```

### Exportar models e executar testes

```bash
dbutility models --target sequelize --conn desenvolvimento --test
```

### Gerar migrações do TypeORM de uma conexão específica

```bash
dbutility migrations --target typeorm --conn producao
```

### Gerar Migrações de Dados (Seeds)

```bash
dbutility migrations --target sequelize --conn desenvolvimento --data --tables "usuarios,cargos"
```

## Licença

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

Veja [LICENSE.pt-BR](./LICENSE.pt-BR) para mais informações.

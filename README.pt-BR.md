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
  },
  "connections": {
    "desenvolvimento": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "username": "root",
      "password": "password",
      "database": "dev_db"
    },
    "producao": {
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

# Conexão com Banco de Dados (Fallback/Base)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=usuario
DB_PASSWORD=senha
DB_NAME=meubanco
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

### Opções de Conexão (Disponíveis para `connect`, `introspect`, `export`, `migration`)

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

### Comandos

#### `connect`

Testa a conexão com o banco de dados.

```bash
dbutility connect [opções-conexão]
```

#### `introspect`

Faz introspecção no esquema do banco de dados.

```bash
dbutility introspect [opções-conexão]
```

#### `export`

Exporta modelos para o ORM alvo.

```bash
dbutility export --target <orm> [opções] [opções-conexão]
```

| Flag                | Descrição                                               | Obrigatório |
| ------------------- | ------------------------------------------------------- | ----------- |
| `--target <target>` | ORM alvo (`sequelize`, `typeorm`, `prisma`, `mongoose`) | Sim         |
| `--output <dir>`    | Diretório de saída                                      | Não         |

#### `migrations`

Gera migrações a partir do esquema do banco de dados.

```bash
dbutility migrations --target <orm> [opções] [opções-conexão]
```

| Flag                | Descrição                                                       | Obrigatório                        |
| ------------------- | --------------------------------------------------------------- | ---------------------------------- |
| `--target <target>` | ORM alvo (`sequelize`, `typeorm`)                               | Sim                                |
| `--output <dir>`    | Diretório de saída                                              | Não                                |
| `--data`            | Gera migração de dados (seeds) junto com o esquema              | Não                                |
| `--only-data`       | Gera APENAS migração de dados                                   | Não                                |
| `--tables <tables>` | Lista de tabelas separadas por vírgula para exportação de dados | Sim (se `--data` ou `--only-data`) |

#### `test`

Testa migrações geradas em containers Docker.

```bash
dbutility test --target <orm> [opções]
```

| Flag                  | Descrição                                                  | Obrigatório |
| --------------------- | ---------------------------------------------------------- | ----------- |
| `--target <target>`   | ORM alvo (`sequelize`, `typeorm`)                          | Sim         |
| `--dir <dir>`         | Diretório contendo as migrações                            | Não         |
| `--engines <engines>` | Imagens Docker para testar (ex: `postgres:14,mysql:8`)     | Não         |
| `--backup`            | Exporta backup do banco de dados do container após o teste | Não         |

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
dbutility export --target sequelize --conn desenvolvimento --output ./src/models
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

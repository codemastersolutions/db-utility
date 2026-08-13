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

Os campos `introspection.outputDir` e `migrations.outputDir` aceitam caminhos relativos ou absolutos.

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

> **Credenciais de Conexão Criptografadas**: Para não armazenar segredos em texto puro no `dbutility.config.json`, defina `"encrypted": true` em cada conexão e substitua os valores de `host`, `port`, `username`, `password` e `database` pelos resultados produzidos por `dbutility encrypt "<texto>"`. A chave de criptografia deve ser informada por meio da variável de ambiente `DBUTILITY_ENCRYPTION_KEY`. A biblioteca descriptografa automaticamente os valores antes de conectar ao banco de dados.

**Passo a passo: Credenciais de Conexão Criptografadas**

1. **Gere uma chave de criptografia forte** e armazene-a no arquivo `.env` ou nas variáveis de ambiente do sistema. Use qualquer valor aleatório criptograficamente seguro (pelo menos 32 caracteres):
   ```bash
   openssl rand -hex 32
   ```
2. **Adicione a chave** ao ambiente (recomendado usar o arquivo `.env` do projeto):
   ```env
   DBUTILITY_ENCRYPTION_KEY="seu-valor-aleatorio-de-64-caracteres-do-passo-1"
   ```
   A biblioteca também aceita os aliases: `DB_UTILITY_ENCRYPTION_KEY`, `DBUTILITY_CRYPTO_KEY` ou `DB_UTILITY_CRYPTO_KEY`.
3. **Criptografe cada um dos 5 campos sensíveis** com a CLI:
   ```bash
   dbutility encrypt "prod-db.internal.empresa.com.br"   # host
   dbutility encrypt "1433"                                # port (como string; é criptografado e depois convertido de volta para inteiro)
   dbutility encrypt "app_user"                            # username
   dbutility encrypt "SenhaF0rte!123"                      # password
   dbutility encrypt "banco_producao"                      # database
   ```
4. **Substitua os valores em texto puro** no `dbutility.config.json` pelas strings criptografadas e marque a conexão:
   ```json
   {
     "connection": {
       "type": "postgres",
       "host": "<host-criptografado>",
       "port": "<port-criptografado>",
       "username": "<usuario-criptografado>",
       "password": "<senha-criptografada>",
       "database": "<banco-criptografado>",
       "ssl": true,
       "connectTimeoutMs": 15000,
       "encrypted": true
     }
   }
   ```
5. **Observações importantes**:
   - Apenas estes 5 campos são criptografados: `host`, `port`, `username`, `password`, `database`.
   - NUNCA criptografe `type`, `ssl`, `connectTimeoutMs` ou o próprio `encrypted`; mantenha-os como valores em texto puro.
   - A mesma `DBUTILITY_ENCRYPTION_KEY` deve estar presente em todos os ambientes onde o DbUtility rodar (notebooks dos devs, CI/CD, servidores de produção).
   - Se você perder a chave de criptografia, não há forma de recuperar os valores criptografados; trate a chave com o mesmo nível de cuidado de qualquer outro segredo.
   - O `port` criptografado fica armazenado como string de cifra; após a descriptografia ele é convertido automaticamente de volta para inteiro.

A propriedade `migrations` aceita tanto um único objeto quanto um array de objetos. Quando for um array, o comando `migrations` executa o processo para cada item na ordem informada.

Você também pode definir `connectionName` em cada item de migration para usar uma conexão específica do objeto `connections`. Se `connectionName` não for informado, a migration usa a conexão padrão definida em `connection`. Se o nome informado não existir em `connections`, o item é ignorado e uma mensagem é exibida ao usuário.

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
      "dataTables": ["usuarios", "perfis"],
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
      "dataTables": ["usuarios", "perfis"]
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

### Configuração da Verificação de Existência da Tabela

Por padrão, as migrations geradas para criação de tabela verificam se a tabela de destino já existe antes de chamar `createTable`. Se a tabela já existir, a migration exibe uma mensagem no terminal e retorna sucesso para que a execução continue sem interrupção. Isso evita falhas causadas por tabelas que tenham sido criadas manualmente antes da execução das migrations.

No **Sequelize 5.x** (onde `queryInterface.tableExists` não existe), a migration gerada faz fallback para `queryInterface.describeTable` e trata um erro de “tabela não existe” como tabela ausente, de forma que a verificação funciona de maneira transparente tanto no Sequelize 5 quanto no Sequelize 6.

Defina `migrations.disableTableExistsCheck` como `true` para desabilitar essa verificação. O valor padrão é `false`. Use esta opção quando você quer que a execução falhe de forma explícita caso uma migration de criação de tabela rode contra um objeto de schema já existente.

```json
{
  "migrations": {
    "disableTableExistsCheck": true
  }
}
```

### Configuração de Exportação Isolada de Migrations

Defina `migrations.exportOnlyInDataTables` como `true` para gerar migrations de schema apenas para as tabelas declaradas em `migrations.dataTables` no arquivo de configuração. O valor padrão é `false`.

Quando essa opção estiver habilitada:

- somente as tabelas listadas em `migrations.dataTables` terão migrations de schema geradas;
- `disableForeignKeys` passa automaticamente a ser tratado como `true`;
- as tabelas geradas passam a funcionar de forma isolada, sem migrations de foreign keys dependendo de outras tabelas.
- `dataTables` precisa estar definido no mesmo item de configuração de migration.

Essa opção está disponível apenas no arquivo de configuração.

```json
{
  "migrations": {
    "dataTables": ["usuarios", "perfis"],
    "exportOnlyInDataTables": true
  }
}
```

### Configuração do Banco para Teste de Migration

Defina `migrations.testDatabase` no arquivo de configuração quando quiser que os testes de migration sejam executados em uma versão ou imagem Docker específica do banco. Essa opção é opcional e está disponível apenas no arquivo de configuração.

Você pode informar somente a versão, e a biblioteca mantém o tipo de banco detectado na introspecção:

```json
{
  "migrations": {
    "testDatabase": "2019"
  }
}
```

Com valores somente de versão, como `2019`, `8` ou `18.4`, o DbUtility:

- mantém o tipo de banco detectado em `database-info.json`;
- resolve a tag disponível mais recente que corresponda ao padrão de versão informado;
- remove blocos da versão progressivamente quando necessário até encontrar uma imagem disponível;
- interrompe o processo de teste com uma mensagem de erro se não encontrar uma imagem Docker compatível.

Você também pode informar uma imagem explícita como string:

```json
{
  "migrations": {
    "testDatabase": "postgres:18.4"
  }
}
```

Strings de imagem usam o Docker Hub por padrão.

Você também pode informar um objeto:

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

Formatos suportados para o objeto:

- `{ "registry": "dhi.io", "image": "node:26-alpine-sfw-ent-dev" }`
- `{ "registry": "mcr.microsoft.com/mssql", "image": "server:2019-latest" }`
- `{ "image": "mcr.microsoft.com/mssql/server:2019-latest" }`

Quando o objeto não incluir `registry`, o DbUtility primeiro tenta usar o valor completo de `image`. Se não encontrar a imagem, tenta novamente usando o Docker Hub. Se ainda assim não encontrar uma imagem válida, o processo de teste é interrompido com uma mensagem de erro.

**Mapeamento Prático de Versões**

| Valor de `testDatabase` | Tipo de banco (da introspecção) | Imagem Docker resolvida exemplo                     |
| ----------------------- | ------------------------------- | --------------------------------------------------- |
| `"2019"`                | MSSQL                           | `mcr.microsoft.com/mssql/server:2019-latest`        |
| `"2016"`                | MSSQL                           | `mcr.microsoft.com/mssql/server:2016-latest`        |
| `"8"`                   | MySQL                           | `mysql:8.<último-minor>.<último-patch>`             |
| `"5.7"`                 | MySQL                           | `mysql:5.7.<último-patch>`                          |
| `"18.4"`                | PostgreSQL                      | `postgres:18.4`                                     |
| `"16"`                  | PostgreSQL                      | `postgres:16-alpine` ou tag mais recente disponível |

Para strings de apenas versão, como `"8"`, o DbUtility resolve progressivamente a tag mais recente disponível (`8.x.y`, com fallback para `8.x`, depois para `8`, parando na primeira imagem existente que o Docker Hub retornar. Registries privados exigem que a imagem já esteja acessível no daemon Docker local (execute `docker login <registry>` previamente).

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

# Desabilita a verificação padrão de existência da tabela nas migrations de createTable (true/false)
DB_UTILITY_MIGRATIONS_DISABLE_TABLE_EXISTS_CHECK=true

# Conexão com Banco de Dados (Fallback/Base)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=usuario
DB_PASSWORD=senha
DB_NAME=meubanco
DB_CONNECT_TIMEOUT_MS=15000

# Chave de criptografia usada para descriptografar os campos da conexão DB (host, port, username, password, database)
# quando "encrypted": true estiver definido no arquivo de configuração ou DBUTILITY_DB_ENCRYPTED=true.
DBUTILITY_ENCRYPTION_KEY="substitua-por-um-segredo-forte-e-aleatorio"

# Quando true, os valores DB_* da conexão devem estar criptografados com a chave acima.
# DBUTILITY_DB_ENCRYPTED=true
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

#### `encrypt` / `decrypt`

Criptografa (ou descriptografa) um único valor usando a chave configurada por `DBUTILITY_ENCRYPTION_KEY`. Use os outputs criptografados com `encrypted: true` na configuração de conexão.

```bash
# Criptografe os segredos da conexão, um por vez:
dbutility encrypt "db.example.internal"
dbutility encrypt "1433"
dbutility encrypt "sa"
dbutility encrypt "MyStr0ng!P@ss"
dbutility encrypt "app_production"

# Descriptografe um valor previamente criptografado para depuração:
dbutility decrypt "<valor-criptografado>"
```

> **Comportamento Padrão**: Por padrão, as credenciais são armazenadas em texto puro no arquivo de configuração. Para habilitar campos criptografados, use `dbutility encrypt` para cada valor sensível, substitua-os no arquivo de configuração pelos resultados e defina `"encrypted": true` na conexão (ou `DBUTILITY_DB_ENCRYPTED=true`). Lembre-se de fornecer a mesma `DBUTILITY_ENCRYPTION_KEY` usada na criptografia. Para desativar a criptografia de credenciais nativa, basta manter ou definir `"encrypted": false` nas suas conexões.

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

| Flag                           | Descrição                                                                                  | Obrigatório                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `--target <target>`            | ORM alvo (`sequelize`, `typeorm`)                                                          | Sim                                                              |
| `--output <dir>`               | Diretório de saída                                                                         | Não                                                              |
| `--data`                       | Gera migração de dados (seeds) junto com o esquema (Sobrescreve configuração)              | Não                                                              |
| `--only-data`                  | Gera APENAS migração de dados                                                              | Não                                                              |
| `--backup`                     | Exporta backup do banco após a execução automática dos testes das migrações                | Não                                                              |
| `--disable-foreign-keys`       | Desabilita a geração de arquivos de migration de foreign keys (`add-fks-*`)                | Não                                                              |
| `--disable-table-exists-check` | Desabilita a verificação padrão de existência da tabela nas migrations de create-table     | Não                                                              |
| `--tables <tables>`            | Lista de tabelas separadas por vírgula para exportação de dados (Sobrescreve configuração) | Sim (se `--data` ou `--only-data` e não estiver na configuração) |
| `--test`                       | Executa o comando test após a geração das migrações                                        | Não                                                              |

Prioridade para `disableForeignKeys`: flag `--disable-foreign-keys` > `dbutility.config.json` > `.env`. Padrão: `false`.
Prioridade para `disableTableExistsCheck`: flag `--disable-table-exists-check` > `dbutility.config.json` > `.env`. Padrão: `false`.
Prioridade para `backup`: flag `--backup` > `dbutility.config.json` > `.env`. Padrão: `false`.
Quando `backup` estiver habilitado por flag, arquivo de configuração ou variável de ambiente, o comando de migrations executa os testes automaticamente mesmo sem `--test`.
Por padrão, as migrations de criação de tabela incluem uma verificação de existência da tabela. Use `--disable-table-exists-check`, `migrations.disableTableExistsCheck` ou `DB_UTILITY_MIGRATIONS_DISABLE_TABLE_EXISTS_CHECK=true` para desabilitá-la.
`migrations.testDatabase` está disponível apenas no arquivo de configuração e é usado quando o mecanismo de teste é inferido a partir de `database-info.json`.

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

Quando `--engines` não for informado, o comando `test` também respeita `migrations.testDatabase` do arquivo de configuração.

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

### Ponta a ponta: credenciais criptografadas para conexão de produção

1. Gere a chave e coloque-a no `.env`:
   ```bash
   openssl rand -hex 32 > /tmp/chave-db
   # copie a saída para o .env como DBUTILITY_ENCRYPTION_KEY=...
   ```
2. Criptografe os 5 valores da conexão:
   ```bash
   export DBUTILITY_ENCRYPTION_KEY=$(cat /tmp/chave-db)
   dbutility encrypt "prod-db.empresa.internal"
   dbutility encrypt "5432"
   dbutility encrypt "app_prod"
   dbutility encrypt "xxxxxxxxxxxxxxxx"
   dbutility encrypt "app_producao"
   ```
3. Cole os resultados no `dbutility.config.json` e marque a conexão com `"encrypted": true`.
4. Valide a conexão sem expor texto puro:
   ```bash
   dbutility connect --conn producao
   ```

### Gerar migrations isoladas apenas para duas tabelas de catálogo/lookup

Quando você precisar exportar somente duas tabelas de lookup, como `status` e `perfis`, independentemente do resto do schema, declare-as em `migrations.dataTables` e ative a flag de exportação isolada:

```json
{
  "migrations": {
    "outputDir": "exports/migrations/lookups",
    "exportOnlyInDataTables": true,
    "dataTables": ["status", "perfis"],
    "disableTableExistsCheck": false
  }
}
```

```bash
dbutility migrations --target sequelize --conn desenvolvimento
```

Isso produz migrations de schema **apenas** para `status` e `perfis`, com `disableForeignKeys` automaticamente igual a `true`, de forma que não existem arquivos `add-fks-*` e as migrations geradas funcionam de forma independente em qualquer banco compatível.

### Gerar migrations e testá-las contra uma versão específica do SQL Server

Se seu cluster de produção ainda está no SQL Server 2016 mas você quer validar as migrations para um alvo mais novo, como 2019:

```json
{
  "migrations": {
    "backup": true,
    "testDatabase": "2019"
  }
}
```

```bash
dbutility migrations --target sequelize --conn producao
```

O tipo de banco (MSSQL) é detectado a partir de `database-info.json`, e o runner de testes sobe a imagem `mcr.microsoft.com/mssql/server:2019-latest` para a validação.

### Desabilitar a verificação padrão de existência de tabela (falha explícita)

Para pipelines de CI que devem falhar quando tabelas já existem, desative a guarda padrão:

```bash
dbutility migrations --target typeorm --conn homologacao --disable-table-exists-check
```

ou configure-a no arquivo:

```json
{
  "migrations": {
    "disableTableExistsCheck": true
  }
}
```

## Licença

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

Veja [LICENSE.pt-BR](./LICENSE.pt-BR) para mais informações.

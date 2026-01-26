# Descrição

Este projeto será um utilitário para auxiliar na manipulação de banco de dados Microsoft SQL Server, MySQL e PostgreSQL. O utilitário será desenvolvido em nodejs e typescrypt, em suas versões LTS. Será publicado como um pacote npm usando commonjs.

# Dados do Projeto

- Nome: DbUtility
- Descrição: O mais poderoso utilitário de banco de dados.
- Tecnologias: Nodejs, Typescript, Commonjs
- Testes: Será usado vitest para testes unitários e integração, com cobertura de código 100%.
- Publicação: Pacote npm(Trusted Publisher) via GitHub Actions, apenas o build e os arquivos necessário para o npm devem ser publicados.
- Repositório NPM: https://www.npmjs.com/package/@codemastersolutions/db-utility
- Repositório: https://github.com/codemastersolutions/db-utility.git
- Licença: MIT nos idiomas inglês(padrão), português e espanhol.
- Autor: CodeMaster Soluções
- Idioma do Projeto: Inglês
- READMEs: Terá os READMEs em inglês(padrão), português e espanhol. Deverá ter links nos READMEs para os outros idiomas. Deve constar instruções para instalar e usar o utilitário.

# Funcionalidades

- Concetar ao banco de dados Microsoft SQL Server, MySQL e PostgreSQL, usando drivers oficiais mssql, mysql2 e pg. Os dados de conexão poderão ser passados via .env ou via arquivo de configuração javascrit ou json.
- Introspecção: O utilitário poderá fazer introspecção no banco de dados, listando tabelas, views, stored procedures, funções e triggers.
- Exportar tabelas para models do sequelize, typeorm e prisma.
- Criar migrations a partir das tabelas existentes no banco de dados para sequelize, typeorm e prisma, usando os drivers oficiais e validando ordem de criação das migrations, considerando as constraints, indexes, primary keys, foreign keys, unique constraints, check constraints, default values, not null constraints, varchar, char, text, blob, enum, set, boolean, tinyint, smallint, mediumint, int, bigint, float, double, decimal, date, datetime, timestamp, time, year.
- CLI: O utilitário poderá ser usado via linha de comando, com comandos para conectar ao banco de dados, fazer introspecção, exportar models e criar migrations.

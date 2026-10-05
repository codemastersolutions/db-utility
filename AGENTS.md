# AGENTS.md — DbUtility

`@codemastersolutions/db-utility` — Node/TypeScript CLI + library for MSSQL/MySQL/Postgres introspection and model/migration generation (Sequelize, TypeORM, Prisma, Mongoose). See `README.md` for user-facing usage; this file covers repo internals.

## Toolchain

- Node `>=18` (CI runs Node 24). pnpm required. `packageManager` pins `pnpm@12.8.1` locally, but CI installs `pnpm@11.21.0` via `pnpm/action-setup@v6` — both versions work, lockfile is regenerated against whichever you have.
- TypeScript → `dist/` (ES2022, CommonJS, `strict: true`, declarations + sourcemaps). `tsconfig.json` excludes `**/*.test.ts`.
- ESLint 9 flat config (`eslint.config.mjs`). Prettier 100 col, single quote, semicolons, 2-space.
- `pnpm-workspace.yaml` lists `.` only (single package). `autoInstallPeers: false` and `onlyBuiltDependencies: [esbuild]` are pinned — do not flip them.

## Commands

| Task | Command |
| --- | --- |
| Unit tests (default, fast) | `pnpm test` |
| Watch tests | `pnpm test:watch` |
| Coverage | `pnpm test:coverage` |
| MSSQL integration suite | `pnpm run test:integration:mssql` (requires Docker in PATH) |
| Just Sequelize MSSQL | `pnpm run test:integration:mssql:sequelize` |
| Just TypeORM MSSQL | `pnpm run test:integration:mssql:typeorm` |
| Lint | `pnpm lint` |
| Format | `pnpm format` |
| Build (publish artifact) | `pnpm build` |
| Single test file | `pnpm vitest run path/to/file.test.ts` |
| Typecheck only | `pnpm exec tsc --noEmit` (no script — `pnpm build` is the only `tsc` entry point) |

**Command order in `prebuild`**: `rimraf dist && lint && format && test` — running `pnpm build` already validates everything. Do not run build without its prebuild chain in CI.

## Tests — read this

- `pnpm test` is **fast, no Docker**. It deliberately skips MSSQL-Docker suites.
- MSSQL integration tests under `tests/integration/testing/` self-skip unless `DBUTILITY_RUN_DOCKER_INTEGRATION=1`. The `test:integration:mssql*` scripts set that env via `cross-env`.
- Those suites spin up real SQL Server containers — slower, requires Docker daemon. Don't run on a machine without Docker.
- Coverage provider is `v8`. `vitest.config.ts` excludes `src/**/*.d.ts` and `src/**/index.ts` from coverage.

## Repo architecture

- `src/cli/index.ts` — CLI entry (`#!/usr/bin/env node`). Defines all `dbutility` commands. Wires every subsystem together.
- `src/config/AppConfig.ts` — typed `AppConfig` + defaults; calls `dotenv.config()` at module load (`.env` is read on first import).
- `src/config/ConfigLoader.ts` / `ConfigInitializer.ts` — `dbutility.config.json` load/save and `--init`/`--force`.
- `src/database/ConnectionFactory.ts` + `src/database/connectors/{Mssql,Mysql,Postgres}Connector.ts` — driver wiring (`mssql`, `mysql2`, `pg`).
- `src/database/SqlSafety.ts` — read-only guardrail. `assertSafeSql` blocks DDL/DML and non-metadata `SELECT`. See "Safety" below.
- `src/introspection/Introspector.ts` + `MssqlIntrospector.ts`, `MysqlIntrospector.ts`, `PostgresIntrospector.ts` — schema discovery. `DataExtractor.ts` handles seed rows.
- `src/generators/{Sequelize,TypeORM,Prisma,Mongoose}Generator.ts` — model/migration writers. `GeneratorWriter.ts` handles file output.
- `src/testing/MigrationTester.ts`, `ModelTester.ts`, `ContainerManager.ts` + `src/testing/runners/{Sequelize,TypeORM}Runner.ts` — Docker-based validation.
- `src/crypto/CryptoService.ts` — AES-encrypt/decrypt for connection fields. Key via `DBUTILITY_ENCRYPTION_KEY`.
- `src/i18n/messages.ts` — every user-facing string in one file (pt-BR default, `en`/`es` aliases). Change it here, not in callers.
- `src/errors/DbUtilityError.ts` — single error class with `code` discriminator; CLI maps codes to localized messages.
- `src/utils/` — column-type mapping, defaults, indexes, table naming, topological sort (migration order via FK dependencies).
- `src/index.ts` — public exports. Add new public APIs here.

## MSSQL-specific schema capture

- `MssqlIntrospector` reads two extra pieces of metadata beyond the cross-dialect set:
  - `sys.indexes.filter_definition` → `IndexMetadata.filterDefinition`. When set, `SequelizeGenerator` / `TypeORMGenerator` emit a raw `CREATE [UNIQUE] INDEX ... WHERE <filter>` instead of `addIndex` (only when `databaseType === 'mssql'`; other dialects fall back to plain `addIndex`).
  - `sys.extended_properties` (class 1 = table, class 2 = column, name = `MS_Description`) → `TableMetadata.description` and `ColumnMetadata.description`. Same generators emit `EXEC sp_addextendedproperty ...` calls after the table/index block, again only when `databaseType === 'mssql'`.
- All other dialects are unaffected — Postgres/MySQL `addIndex` and the model/entity output are unchanged.

## Config — read this

- **Precedence** (highest first): CLI flags → `dbutility.config.json` → `.env`.
- `dbutility.config.json` is **gitignored** (it carries encrypted real connections in this repo, e.g. `asti`, `corporerm`). Do not commit it. `.env` is also gitignored; only `.env.example` is tracked.
- `migrations` accepts a **single object or an array**. When array, each item can carry `connectionName` pointing to `connections.<name>`. Missing names are skipped with a warning, not a hard error.
- `connection` is the fallback connection. `connections` is a named map for `--conn <name>`.
- CLI runs an **automatic npm registry version probe** by default (10s timeout, daily/weekly/monthly). Disable via `versionCheck.enabled: false` in config.
- `migrations.testDatabase` is **config-only**. Accepts version string (`"2019"`, `"8"`, `"18.4"`) or `{ registry, image }`. Auto-resolves latest matching tag from Docker Hub; private registries need `docker login` first.

## Encrypted connection fields — read this

Only these 5 fields are encrypted: `host`, `port`, `username`, `password`, `database`. Encrypted `port` is stored as cipher string and parsed back to integer on use.
- `type`, `ssl`, `connectTimeoutMs`, `encrypted` itself — never encrypt these, they are plaintext.
- `DBUTILITY_ENCRYPTION_KEY` (aliases `DB_UTILITY_ENCRYPTION_KEY`, `DBUTILITY_CRYPTO_KEY`, `DB_UTILITY_CRYPTO_KEY`) must exist in every environment that runs DbUtility. Lost key = lost credentials.
- CLI subcommands: `dbutility encrypt "<value>"` / `dbutility decrypt "<cipher>"`. Mark connection with `"encrypted": true` (or `DBUTILITY_DB_ENCRYPTED=true`).

## Safety — read this

`assertSafeSql` (`src/database/SqlSafety.ts`) rejects: `INSERT`, `DELETE`, `UPDATE`, `MERGE`, `DROP`, `TRUNCATE`, `ALTER`, `CREATE`, `GRANT`, `REVOKE`, `EXECUTE`, `EXEC`, `CALL`. Plus any `SELECT` not matching metadata patterns (`information_schema.`, `pg_catalog`, `sys.`, or `SELECT 1`). The library is intentionally metadata-only — recommend a **read-only DB user** when running.

## Generated migrations behavior

- By default, generated create-table migrations check existence first (`tableExists` → `describeTable` fallback for Sequelize 5.x). Disable via `migrations.disableTableExistsCheck` or `--disable-table-exists-check` flag.
- `disableForeignKeys` priority: CLI flag `--disable-foreign-keys` > config > `.env`.
- `backup` enabled by any source auto-runs migration tests (even without `--test`).
- `exportOnlyInDataTables: true` forces `disableForeignKeys: true` implicitly; `dataTables` must be defined in the same item.

## Migration test SQL logging

- The `test` command (and the `migrations` command's `--test` phase) **prints every SQL statement** the ORM sends to the test database by default, plus elapsed time, plus a `→ Running migration: <file>` header before each migration file.
- Opt out per-run with `--no-sql-log` on either command.
- Config: `migrations.test.logging` (default `true`). Env var: `DBUTILITY_MIGRATIONS_TEST_LOGGING=false`.
- Precedence matches `disableForeignKeys`: `--no-sql-log` flag wins over config and env.
- Implementation lives in `src/testing/runners/{Sequelize,TypeORM}Runner.ts`. Both inject a `DataSource`/Sequelize `logging` callback that prefixes each statement with `[sequelize-sql]` or `[typeorm-sql]` and the resolved connection label.

## Commits and release

- **One-time hook install** (fresh clones only): `pnpm commitzero:install`. After that, use `pnpm commit` / `pnpm commit:push`. Raw `git commit` is not gated by CommitZero until the hooks are installed — after install, raw commits are blocked. `pnpm commitzero:uninstall` removes them.
- **Release is automated** by `.github/workflows/npm-publish.yml` on push to `main`: runs `pnpm test` + `pnpm run build` → `pnpm version patch -m "chore(release): %s [skip ci]"` → `pnpm publish --no-git-checks --provenance --access public`. Do not bump versions or push tags locally — CI owns the release.
- After editing `package.json`, run `pnpm install` to update `pnpm-lock.yaml`; CI uses `--frozen-lockfile`.

## Things easy to miss

- `dotenv.config()` runs as a side effect of importing `src/config/AppConfig.ts` (anywhere in the tree). Config files and `.env` are loaded transitively from `cli/index.ts` startup.
- `dist/` is the published artifact. `package.json#files` only ships `dist`, the three READMEs (`README.md`, `README.pt-BR.md`, `README.es.md`), and the three LICENSE files. Do not add source/tests to the files list.
- CLI registers three bin names — `db-utility`, `dbutility`, `dbutil` — all pointing to `dist/cli/index.js`.
- `format` runs on both `src/**/*.ts` and `tests/**/*.ts`; `lint` runs on `src/**/*.ts` only; `tsc` excludes `**/*.test.ts` and `**/*.spec.ts`. Keep test files lint/format-clean.
- `.gitignore` excludes: `node_modules`, `dist`, `coverage`, `.env*` (except `.env.example`), `exports`, `dbutility.config.json`, `db-utility-migrations`, `**/generated-migrations`, `**/generated-models`, `.DS_Store`, `*.log`.
- `docker-compose.yml` brings up MSSQL/MySQL/MariaDB/Postgres on ports `1499/3399/3398/5499` with default creds (SA `SqlServer2022!`, root passwords `mysqlroot`/`mariadbroot`/`postgresroot`). Integration tests do **not** consume compose; they spin per-test containers via `ContainerManager`. Use compose for manual interactive testing only.
# DbUtility

> La utilidad de base de datos más poderosa.

[![npm version](https://img.shields.io/npm/v/@codemastersolutions/db-utility.svg)](https://www.npmjs.com/package/@codemastersolutions/db-utility)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[🇺🇸 English](./README.md) | [🇧🇷 Português](./README.pt-BR.md)**

DbUtility es una utilidad poderosa para manipular bases de datos Microsoft SQL Server, MySQL y PostgreSQL. Desarrollada en Node.js y TypeScript, su objetivo es simplificar la conexión a bases de datos, introspección, exportación de modelos y creación de migraciones.

## Características

- **Soporte Multi-Base de Datos**: Conéctese a Microsoft SQL Server, MySQL y PostgreSQL utilizando controladores oficiales (`mssql`, `mysql2`, `pg`).
- **Configuración Flexible**: Detalles de conexión a través de CLI, `.env`, archivos de configuración JSON.
- **Introspección**: Analice su base de datos para listar tablas, vistas, procedimientos almacenados, funciones y disparadores.
- **Exportación de Modelos**: Exporte tablas de base de datos a modelos de Sequelize, TypeORM, Prisma y Mongoose.
- **Generación de Migraciones**: Cree migraciones de esquema y datos a partir de tablas existentes en la base de datos para Sequelize y TypeORM.

## Instalación

```bash
npm install @codemastersolutions/db-utility
# o globalmente
npm install -g @codemastersolutions/db-utility
```

## Pruebas de Integracion MSSQL

DbUtility incluye pruebas de integracion opt-in para Microsoft SQL Server que validan los runners reales de migracion contra un contenedor Docker.

Actualmente, estas pruebas cubren:

- migraciones Sequelize con columnas de texto largas en MSSQL
- migraciones TypeORM con columnas de texto largas en MSSQL
- migraciones Sequelize que omiten defaults numéricos inválidos en columnas date/datetimeoffset de MSSQL
- migraciones Sequelize que preservan claves foráneas compuestas con columnas referenciadas coincidentes
- migraciones Sequelize que preservan auto-relaciones con claves foráneas compuestas
- migraciones Sequelize que preservan claves foráneas compuestas con `ON DELETE SET NULL`
- migraciones TypeORM que preservan tipos date/datetimeoffset de MSSQL y omiten defaults numéricos inválidos
- inserciones reales de valores con mas de 4000 caracteres sin errores de tamano de parametro

Prerequisitos:

- Docker instalado y disponible en su `PATH`
- Dependencias de desarrollo instaladas con `pnpm install`

Scripts disponibles:

```bash
# Ejecuta las dos suites de integracion MSSQL
pnpm run test:integration:mssql

# Ejecuta solo las integraciones Sequelize + MSSQL
pnpm run test:integration:mssql:sequelize

# Ejecuta solo la integracion TypeORM + MSSQL
pnpm run test:integration:mssql:typeorm
```

Notas:

- Estos scripts activan automaticamente `DBUTILITY_RUN_DOCKER_INTEGRATION=1`.
- Usan `cross-env`, por lo que los mismos comandos funcionan en macOS, Linux y Windows.
- Se mantienen separados de `pnpm test` para conservar la suite predeterminada rapida.
- Las pruebas levantan contenedores reales de SQL Server y pueden tardar mas que las pruebas unitarias.

## Uso de Internet

Esta librería utiliza su conexión a internet para buscar actualizaciones en el registro npm. Esta verificación se realiza automáticamente (predeterminado: diariamente) cuando ejecuta un comando de la CLI.

- **Tiempo de espera**: La verificación tiene un tiempo de espera de 10 segundos.
- **Sin conexión**: Si no se detecta conexión a internet, la verificación se omite silenciosamente.
- **Privacidad**: No se recopilan datos personales. Solo se compara la versión del paquete.
- **Configuración**: Puede desactivar esta función o cambiar la frecuencia en el archivo de configuración.

## Configuración

### Inicialización

Puede inicializar un archivo de configuración predeterminado utilizando el comando CLI:

```bash
dbutility --init
```

Si el archivo ya existe, puede forzar la recreación con valores predeterminados:

```bash
dbutility --init -f
# o
dbutility --init --force
```

### Archivo de Configuración (dbutility.config.json)

El archivo de configuración permite definir el idioma de la CLI, directorios de salida, patrones de nombres y configuraciones de conexión a la base de datos.

```json
{
  "language": "es",
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
    "dataTables": ["usuarios", { "table": "logs", "where": "nivel = 'ERROR'" }],
    "backup": true,
    "disableForeignKeys": false
  },
  "connection": {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "usuario",
    "password": "password",
    "database": "mibasedatos",
    "ssl": false,
    "connectTimeoutMs": 15000
  },
  "connections": {
    "desarrollo": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "username": "root",
      "password": "password",
      "database": "dev_db",
      "connectTimeoutMs": 15000
    },
    "produccion": {
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

La propiedad `migrations` acepta tanto un objeto único como un arreglo de objetos. Cuando es un arreglo, el comando `migrations` ejecuta el proceso para cada elemento en el orden definido.

También puede definir `connectionName` en cada elemento de migración para usar una conexión específica del objeto `connections`. Si `connectionName` no se informa, la migración usa la conexión predeterminada definida en `connection`. Si el nombre informado no existe en `connections`, ese elemento de migración se omite y se muestra una advertencia al usuario.

```json
{
  "target": "sequelize",
  "migrations": [
    {
      "outputDir": "exports/migrations/tenant-a",
      "fileNamePattern": "timestamp-prefix",
      "connectionName": "tenantA",
      "disableForeignKeys": true
    },
    {
      "outputDir": "exports/migrations/tenant-b",
      "fileNamePattern": "timestamp-prefix",
      "connectionName": "tenantB",
      "data": true,
      "dataTables": ["usuarios", "roles"]
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

### Configuración de Verificación de Versión

Puede configurar la verificación automática de versión en `dbutility.config.json`.

```json
{
  "versionCheck": {
    "enabled": true,
    "frequency": "daily"
  }
}
```

- **`enabled`** (boolean): Establezca en `true` para habilitar la verificación de versión, `false` para deshabilitarla. Predeterminado: `true`.
- **`frequency`** (string): Con qué frecuencia verificar actualizaciones.
  - `"daily"`: Una vez al día (predeterminado).
  - `"weekly"`: Una vez a la semana.
  - `"monthly"`: Una vez al mes.

### Configuración Avanzada de Extracción de Datos

La opción `dataTables` permite especificar qué tablas deben tener sus datos exportados (para seeds). Puede proporcionar una lista simple de nombres de tablas o un objeto con una cláusula `where` para filtrar los datos.

```json
"dataTables": [
  "roles",
  "permisos",
  {
    "table": "usuarios",
    "where": "activo = 1 AND creado_en > '2023-01-01'",
    "disableIdentity": true
  },
  {
    "table": "registros",
    "where": "nivel = 'ERROR'"
  }
]
```

La opción `disableIdentity` (predeterminado: `false`) permite insertar valores explícitos en columnas auto-increment/identity. Esto es útil cuando desea preservar los IDs originales de la base de datos de origen.

- **MSSQL**: Envuelve las inserciones con `SET IDENTITY_INSERT [Table] ON/OFF`.
- **PostgreSQL**: Reinicia el valor de la secuencia después de la inserción usando `setval` para evitar fallos en inserciones posteriores.
- **Otras Bases de Datos (MySQL, SQLite)**: Incluye la columna identity en el payload de inserción (normalmente actualizan el contador auto-incremental automáticamente).

### Configuración de Migraciones de Foreign Keys

Defina `migrations.disableForeignKeys` como `true` para omitir la generación de archivos de migración `add-fks-*`. El valor predeterminado es `false`.

```json
{
  "migrations": {
    "disableForeignKeys": true
  }
}
```

### Múltiples Conexiones

Puede definir múltiples conexiones dentro de la propiedad `connections` y utilizarlas en la CLI con el flag `--conn <nombre>`.

Ejemplo:

```bash
dbutility connect --conn desarrollo
```

### Prioridad de Configuración

La configuración se carga con el siguiente orden de prioridad (la prioridad más alta sobrescribe la más baja):

1. **Flags de la CLI**: Argumentos pasados directamente al comando (ej: `-u usuario`).
2. **Archivo de Configuración**: Configuraciones en `dbutility.config.json`.
3. **Variables de Entorno**: Variables definidas en `.env`.

Esto permite tener configuraciones base en `.env`, configuraciones específicas del proyecto en `dbutility.config.json` y sobrescribir valores específicos (como la contraseña) a través de la CLI cuando sea necesario.

### Variables de Entorno (.env)

También puede configurar DbUtility utilizando variables de entorno.

```env
# Idioma (pt-BR, en, es)
DB_UTILITY_LANG=es

# Directorios de Salida
DB_UTILITY_INTROSPECTION_OUTPUT_DIR=mi-directorio-introspect
DB_UTILITY_MIGRATIONS_OUTPUT_DIR=mi-directorio-migrations

# Patrón de Nombre de Archivo de Migración (timestamp-prefix, prefix-timestamp)
DB_UTILITY_MIGRATIONS_FILE_NAME_PATTERN=prefix-timestamp

# Datos de Migración (true/false)
DB_UTILITY_MIGRATIONS_DATA=true

# Tablas de Datos para Migración (Separadas por coma)
DB_UTILITY_MIGRATIONS_DATA_TABLES=usuarios,roles

# Backup de Migración (true/false)
DB_UTILITY_MIGRATIONS_BACKUP=true

# Deshabilita la generación de migraciones de foreign keys (true/false)
DB_UTILITY_MIGRATIONS_DISABLE_FOREIGN_KEYS=true

# Conexión a Base de Datos (Fallback/Base)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=usuario
DB_PASSWORD=password
DB_NAME=mibasedatos
DB_CONNECT_TIMEOUT_MS=15000
```

## Comandos y Flags de la CLI

> **Nota de Seguridad**: Recomendamos encarecidamente utilizar un usuario de base de datos con permisos de **solo lectura** (SELECT) para realizar operaciones de introspección y exportación. Esto minimiza el riesgo de modificaciones accidentales de datos. La biblioteca DbUtility solo ejecuta consultas de metadatos (estructura de la base de datos) y bloquea comandos que puedan modificar datos o leer filas de tablas de negocio.

### Opciones Globales

| Flag            | Descripción                                                    |
| --------------- | -------------------------------------------------------------- |
| `--init`        | Inicializa el archivo de configuración                         |
| `-f, --force`   | Fuerza la recreación del archivo de configuración si ya existe |
| `-v, --version` | Muestra el número de la versión                                |
| `-h, --help`    | Muestra ayuda para el comando                                  |

### Opciones de Conexión (Disponibles para `connect`, `introspect`, `models`, `migrations`)

| Flag                        | Descripción                                                   |
| --------------------------- | ------------------------------------------------------------- |
| `--conn <name>`             | Nombre de la conexión definida en el archivo de configuración |
| `-c, --config <path>`       | Ruta al archivo de configuración                              |
| `-t, --type <type>`         | Tipo de base de datos (`mysql`, `postgres`, `mssql`)          |
| `-H, --host <host>`         | Host de la base de datos                                      |
| `-P, --port <port>`         | Puerto de la base de datos                                    |
| `-u, --username <username>` | Usuario de la base de datos                                   |
| `-p, --password <password>` | Contraseña de la base de datos                                |
| `-d, --database <database>` | Nombre de la base de datos                                    |
| `--ssl`                     | Habilita conexión SSL                                         |
| `--connect-timeout <ms>`    | Timeout de conexión (ms)                                      |

### Comandos

#### `connect`

Prueba la conexión con la base de datos.

```bash
dbutility connect [opciones-conexión]
```

#### `introspect`

Realiza introspección en el esquema de la base de datos.

Muestra advertencias en la terminal cuando el schema contiene tablas con más de 32 columnas o índices con más de 32 columnas clave. Los detalles completos también se guardan en el `metadata.json` generado.

```bash
dbutility introspect [opciones-conexión]
```

#### `models`

Exporta modelos para el ORM objetivo.

Cuando el schema de origen contiene tablas anchas o listas de claves de índice por encima del límite, la CLI muestra advertencias antes de generar los archivos para facilitar la revisión de estos casos.

```bash
dbutility models --target <orm> [opciones] [opciones-conexión]
```

| Flag                | Descripción                                                 | Obligatorio |
| ------------------- | ----------------------------------------------------------- | ----------- |
| `--target <target>` | ORM objetivo (`sequelize`, `typeorm`, `prisma`, `mongoose`) | Sí          |
| `--output <dir>`    | Directorio de salida                                        | No          |
| `--test`            | Ejecuta pruebas en los modelos generados                    | No          |

#### `migrations`

Genera migraciones a partir del esquema de la base de datos.

Cuando el schema de origen contiene tablas anchas o listas de claves de índice por encima del límite, la CLI muestra advertencias antes de generar los archivos para facilitar la revisión de estos casos.

```bash
dbutility migrations --target <orm> [opciones] [opciones-conexión]
```

| Flag                | Descripción                                                                              | Obligatorio                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `--target <target>` | ORM objetivo (`sequelize`, `typeorm`)                                                    | Sí                                                             |
| `--output <dir>`    | Directorio de salida                                                                     | No                                                             |
| `--data`            | Genera migración de datos (seeds) junto con el esquema (Sobrescribe configuración)       | No                                                             |
| `--only-data`       | Genera SOLO migración de datos                                                           | No                                                             |
| `--backup`          | Exporta un backup de la base de datos después de la ejecución automática de pruebas      | No                                                             |
| `--disable-foreign-keys` | Deshabilita la generación de archivos de migración de foreign keys (`add-fks-*`) | No                                                             |
| `--tables <tables>` | Lista de tablas separadas por coma para exportación de datos (Sobrescribe configuración) | Sí (si `--data` o `--only-data` y no está en la configuración) |
| `--test`            | Ejecuta el comando test después de la generación de migraciones                          | No                                                             |

Prioridad para `disableForeignKeys`: flag `--disable-foreign-keys` > `dbutility.config.json` > `.env`. Predeterminado: `false`.
Prioridad para `backup`: flag `--backup` > `dbutility.config.json` > `.env`. Predeterminado: `false`.
Cuando `backup` está habilitado por flag, archivo de configuración o variable de entorno, el comando de migraciones ejecuta las pruebas automáticamente incluso sin `--test`.

#### `test`

Prueba migraciones generadas en contenedores Docker.

```bash
dbutility test --target <orm> [opciones]
```

| Flag                  | Descripción                                                                                        | Obligatorio |
| --------------------- | -------------------------------------------------------------------------------------------------- | ----------- |
| `--target <target>`   | ORM objetivo (`sequelize`, `typeorm`)                                                              | Sí          |
| `--dir <dir>`         | Directorio conteniendo las migraciones                                                             | No          |
| `--engines <engines>` | Imágenes Docker para probar (ej: `postgres:14,mysql:8`)                                            | No          |
| `--backup`            | Exporta backup de la base de datos del contenedor después de la prueba (Sobrescribe configuración) | No          |

## Ejemplos de Uso

### Conectar a una base de datos usando una conexión con nombre

```bash
dbutility connect --conn produccion
```

### Realizar introspección de una base de datos usando parámetros de conexión en línea

```bash
dbutility introspect --type postgres --host localhost --username usuario --password contrasena --database mibasedatos
```

### Exportar modelos de Sequelize desde una conexión específica

```bash
dbutility models --target sequelize --conn desarrollo --output ./src/models
```

### Exportar modelos y ejecutar pruebas

```bash
dbutility models --target sequelize --conn desarrollo --test
```

### Generar migraciones de TypeORM desde una conexión específica

```bash
dbutility migrations --target typeorm --conn produccion
```

### Generar Migraciones de Datos (Seeds)

```bash
dbutility migrations --target sequelize --conn desarrollo --data --tables "usuarios,roles"
```

## Licencia

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

Ver [LICENSE.es](./LICENSE.es) para más información.

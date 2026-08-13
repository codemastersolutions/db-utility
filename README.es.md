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

Los campos `introspection.outputDir` y `migrations.outputDir` aceptan rutas relativas o absolutas.

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
    "desarrollo": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "username": "root",
      "password": "password",
      "database": "desarrollo_db",
      "connectTimeoutMs": 15000,
      "encrypted": false
    },
    "produccion": {
      "type": "postgres",
      "host": "prod-db",
      "port": 5432,
      "username": "admin",
      "password": "secure_password",
      "database": "produccion_db",
      "ssl": true,
      "connectTimeoutMs": 15000,
      "encrypted": false
    }
  }
}
```

> **Credenciales de Conexión Cifradas**: Para evitar almacenar secretos en texto plano en `dbutility.config.json`, define `"encrypted": true` en cada conexión y reemplaza los valores de `host`, `port`, `username`, `password` y `database` por los resultados producidos por `dbutility encrypt "<texto>"`. La clave de cifrado debe proporcionarse mediante la variable de entorno `DBUTILITY_ENCRYPTION_KEY`. La biblioteca descifra automáticamente los valores antes de conectar con la base de datos.

**Paso a paso: Credenciales de Conexión Cifradas**

1. **Genere una clave de cifrado fuerte** y guárdela en su archivo `.env` o en las variables de entorno del sistema. Puede usar cualquier valor aleatorio criptográficamente seguro (al menos 32 caracteres):
   ```bash
   openssl rand -hex 32
   ```
2. **Agregue la clave** al entorno (se recomienda el archivo `.env` del proyecto):
   ```env
   DBUTILITY_ENCRYPTION_KEY="su-valor-aleatorio-de-64-caracteres-del-paso-1"
   ```
   La biblioteca también acepta los alias: `DB_UTILITY_ENCRYPTION_KEY`, `DBUTILITY_CRYPTO_KEY` o `DB_UTILITY_CRYPTO_KEY`.
3. **Cifre cada uno de los 5 campos sensibles** con la CLI:
   ```bash
   dbutility encrypt "prod-db.internal.empresa.com"   # host
   dbutility encrypt "1433"                            # port (como texto; se cifra y luego se convierte de nuevo a entero)
   dbutility encrypt "app_user"                        # username
   dbutility encrypt "ContraseñaFuerte!123"            # password
   dbutility encrypt "base_produccion"                 # database
   ```
4. **Reemplace los valores en texto plano** en `dbutility.config.json` por las cadenas cifradas y marque la conexión:
   ```json
   {
     "connection": {
       "type": "postgres",
       "host": "<host-cifrado>",
       "port": "<puerto-cifrado>",
       "username": "<usuario-cifrado>",
       "password": "<contraseña-cifrada>",
       "database": "<base-cifrada>",
       "ssl": true,
       "connectTimeoutMs": 15000,
       "encrypted": true
     }
   }
   ```
5. **Notas importantes**:
   - Solo estos 5 campos se cifran: `host`, `port`, `username`, `password`, `database`.
   - NUNCA cifre `type`, `ssl`, `connectTimeoutMs` ni el propio `encrypted`; manténgalos como valores en texto plano.
   - La misma `DBUTILITY_ENCRYPTION_KEY` debe estar presente en todos los entornos donde se ejecute DbUtility (equipos de desarrollo, CI/CD, servidores de producción).
   - Si pierde la clave de cifrado, no hay forma de recuperar los valores cifrados; trate la clave con el mismo nivel de cuidado que cualquier otro secreto.
   - El `port` cifrado se guarda como cadena de cifra; tras descifrarse se convierte automáticamente de nuevo a entero.

La propiedad `migrations` acepta tanto un único objeto como un array de objetos. Cuando es un arreglo, el comando `migrations` ejecuta el proceso para cada elemento en el orden definido.

También puede definir `connectionName` en cada elemento de migración para usar una conexión específica del objeto `connections`. Si `connectionName` no se informa, la migración usa la conexión predeterminada definida en `connection`. Si el nombre informado no existe en `connections`, ese elemento de migración se omite y se muestra una advertencia al usuario.

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
      "dataTables": ["usuarios", "roles"],
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

### Configuración de la Verificación de Existencia de la Tabla

De forma predeterminada, las migraciones generadas para crear tablas verifican si la tabla de destino ya existe antes de llamar a `createTable`. Si la tabla ya existe, la migración muestra un mensaje en la terminal y devuelve éxito para que la ejecución continúe sin interrupciones. Esto evita fallos causados por tablas que se crearon manualmente antes de ejecutar las migraciones.

En **Sequelize 5.x** (donde `queryInterface.tableExists` no está disponible), la migración generada usa como fallback `queryInterface.describeTable` y trata un error de "tabla no existe" como tabla ausente, de modo que la verificación funciona de forma transparente en Sequelize 5 y Sequelize 6.

Defina `migrations.disableTableExistsCheck` como `true` para deshabilitar esta verificación. El valor predeterminado es `false`. Use esta opción cuando quiera que la ejecución falle de forma explícita si una migración de creación de tabla se ejecuta contra un objeto de esquema ya existente.

```json
{
  "migrations": {
    "disableTableExistsCheck": true
  }
}
```

### Configuración de Exportación Aislada de Migraciones

Defina `migrations.exportOnlyInDataTables` como `true` para generar migraciones de schema solo para las tablas declaradas en `migrations.dataTables` del archivo de configuración. El valor predeterminado es `false`.

Cuando esta opción está habilitada:

- solo las tablas listadas en `migrations.dataTables` se exportan como migraciones de schema;
- `disableForeignKeys` pasa automáticamente a ser tratado como `true`;
- las tablas generadas pasan a funcionar de forma aislada, sin migraciones de foreign keys que dependan de otras tablas.
- `dataTables` debe estar definido en el mismo elemento de configuración de migración.

Esta opción está disponible solo en el archivo de configuración.

```json
{
  "migrations": {
    "dataTables": ["usuarios", "roles"],
    "exportOnlyInDataTables": true
  }
}
```

### Configuración de la Base de Datos para la Prueba de Migraciones

Defina `migrations.testDatabase` en el archivo de configuración cuando quiera que las pruebas de migraciones se ejecuten con una versión o imagen Docker específica de la base de datos. Esta opción es opcional y está disponible solo en el archivo de configuración.

Puede informar solo la versión, y la librería mantiene el tipo de base de datos detectado por la introspección:

```json
{
  "migrations": {
    "testDatabase": "2019"
  }
}
```

Con valores de solo versión, como `2019`, `8` o `18.4`, DbUtility:

- mantiene el tipo de base de datos detectado en `database-info.json`;
- resuelve la etiqueta disponible más reciente que coincida con el patrón de versión informado;
- elimina bloques de la versión progresivamente cuando es necesario hasta encontrar una imagen disponible;
- interrumpe el proceso de prueba con un mensaje de error si no encuentra una imagen Docker compatible.

También puede informar una imagen explícita como string:

```json
{
  "migrations": {
    "testDatabase": "postgres:18.4"
  }
}
```

Las strings de imagen usan Docker Hub por defecto.

También puede informar un objeto:

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

Formatos soportados para el objeto:

- `{ "registry": "dhi.io", "image": "node:26-alpine-sfw-ent-dev" }`
- `{ "registry": "mcr.microsoft.com/mssql", "image": "server:2019-latest" }`
- `{ "image": "mcr.microsoft.com/mssql/server:2019-latest" }`

Cuando el objeto no incluye `registry`, DbUtility primero intenta usar el valor completo de `image`. Si no encuentra la imagen, vuelve a intentar usando Docker Hub. Si aun así no encuentra una imagen válida, el proceso de prueba se interrumpe con un mensaje de error.

**Asignación Práctica de Versiones**

| Valor de `testDatabase` | Tipo de base (por introspección) | Ejemplo de imagen Docker resuelta                          |
| ----------------------- | -------------------------------- | ---------------------------------------------------------- |
| `"2019"`                | MSSQL                            | `mcr.microsoft.com/mssql/server:2019-latest`               |
| `"2016"`                | MSSQL                            | `mcr.microsoft.com/mssql/server:2016-latest`               |
| `"8"`                   | MySQL                            | `mysql:8.<último-minor>.<último-parche>`                   |
| `"5.7"`                 | MySQL                            | `mysql:5.7.<último-parche>`                                |
| `"18.4"`                | PostgreSQL                       | `postgres:18.4`                                            |
| `"16"`                  | PostgreSQL                       | `postgres:16-alpine` o la etiqueta más reciente disponible |

Para cadenas de solo versión, como `"8"`, DbUtility resuelve progresivamente la etiqueta disponible más reciente (`8.x.y`, con fallback a `8.x`, luego a `8`, deteniéndose en la primera imagen existente que Docker Hub retorne. Los registros privados requieren que la imagen ya sea accesible desde el daemon Docker local (ejecute `docker login <registry>` previamente).

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

# Deshabilita la verificación predeterminada de existencia de la tabla en migraciones createTable (true/false)
DB_UTILITY_MIGRATIONS_DISABLE_TABLE_EXISTS_CHECK=true

# Conexión a Base de Datos (Fallback/Base)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=usuario
DB_PASSWORD=password
DB_NAME=mibasedatos
DB_CONNECT_TIMEOUT_MS=15000

# Clave de cifrado usada para descifrar los campos de conexión DB (host, port, username, password, database)
# cuando "encrypted": true está establecido en el archivo de configuración o DBUTILITY_DB_ENCRYPTED=true.
DBUTILITY_ENCRYPTION_KEY="reemplazar-por-un-secreto-fuerte-y-aleatorio"

# Cuando true, los valores DB_* de la conexión deben estar cifrados con la clave anterior.
# DBUTILITY_DB_ENCRYPTED=true
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

#### `encrypt` / `decrypt`

Cifra (o descifra) un único valor utilizando la clave configurada mediante `DBUTILITY_ENCRYPTION_KEY`. Utiliza los salidas cifradas con `encrypted: true` en la configuración de conexión.

```bash
# Cifre los secretos de la conexión, uno por uno:
dbutility encrypt "db.example.internal"
dbutility encrypt "1433"
dbutility encrypt "sa"
dbutility encrypt "MyStr0ng!P@ss"
dbutility encrypt "app_produccion"

# Descifre un valor previamente cifrado para depurar:
dbutility decrypt "<valor-cifrado>"
```

> **Comportamiento Predeterminado**: Por defecto, las credenciales se almacenan en texto plano en el archivo de configuración. Para habilitar los campos cifrados, utilice `dbutility encrypt` para cada valor sensible, reemplácelos en el archivo de configuración con los resultados y establezca `"encrypted": true` en la conexión (o `DBUTILITY_DB_ENCRYPTED=true`). Recuerde proporcionar la misma `DBUTILITY_ENCRYPTION_KEY` utilizada durante el cifrado. Para desactivar el cifrado de credenciales nativo, basta con mantener o definir `"encrypted": false` en sus conexiones.

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

| Flag                           | Descripción                                                                                      | Obligatorio                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `--target <target>`            | ORM objetivo (`sequelize`, `typeorm`)                                                            | Sí                                                             |
| `--output <dir>`               | Directorio de salida                                                                             | No                                                             |
| `--data`                       | Genera migración de datos (seeds) junto con el esquema (Sobrescribe configuración)               | No                                                             |
| `--only-data`                  | Genera SOLO migración de datos                                                                   | No                                                             |
| `--backup`                     | Exporta un backup de la base de datos después de la ejecución automática de pruebas              | No                                                             |
| `--disable-foreign-keys`       | Deshabilita la generación de archivos de migración de foreign keys (`add-fks-*`)                 | No                                                             |
| `--disable-table-exists-check` | Deshabilita la verificación predeterminada de existencia de la tabla en migraciones create-table | No                                                             |
| `--tables <tables>`            | Lista de tablas separadas por coma para exportación de datos (Sobrescribe configuración)         | Sí (si `--data` o `--only-data` y no está en la configuración) |
| `--test`                       | Ejecuta el comando test después de la generación de migraciones                                  | No                                                             |

Prioridad para `disableForeignKeys`: flag `--disable-foreign-keys` > `dbutility.config.json` > `.env`. Predeterminado: `false`.
Prioridad para `disableTableExistsCheck`: flag `--disable-table-exists-check` > `dbutility.config.json` > `.env`. Predeterminado: `false`.
Prioridad para `backup`: flag `--backup` > `dbutility.config.json` > `.env`. Predeterminado: `false`.
Cuando `backup` está habilitado por flag, archivo de configuración o variable de entorno, el comando de migraciones ejecuta las pruebas automáticamente incluso sin `--test`.
De forma predeterminada, las migraciones de creación de tabla incluyen una verificación de existencia de la tabla. Use `--disable-table-exists-check`, `migrations.disableTableExistsCheck` o `DB_UTILITY_MIGRATIONS_DISABLE_TABLE_EXISTS_CHECK=true` para deshabilitarla.
`migrations.testDatabase` está disponible solo en el archivo de configuración y se usa cuando el motor de prueba se infiere desde `database-info.json`.

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

Cuando no se informa `--engines`, el comando `test` también respeta `migrations.testDatabase` del archivo de configuración.

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

### De principio a fin: credenciales cifradas para conexión de producción

1. Genere la clave y colóquela en `.env`:
   ```bash
   openssl rand -hex 32 > /tmp/clave-db
   # copie la salida en .env como DBUTILITY_ENCRYPTION_KEY=...
   ```
2. Cifre los 5 valores de conexión:
   ```bash
   export DBUTILITY_ENCRYPTION_KEY=$(cat /tmp/clave-db)
   dbutility encrypt "prod-db.empresa.internal"
   dbutility encrypt "5432"
   dbutility encrypt "app_prod"
   dbutility encrypt "xxxxxxxxxxxxxxxx"
   dbutility encrypt "app_produccion"
   ```
3. Pegue los resultados en `dbutility.config.json` y marque la conexión con `"encrypted": true`.
4. Valide la conexión sin exponer texto plano:
   ```bash
   dbutility connect --conn produccion
   ```

### Generar migraciones aisladas para solo dos tablas de catálogo/lookup

Cuando necesite exportar únicamente dos tablas de lookup, como `estados` y `roles`, independientemente del resto del esquema, declárelas en `migrations.dataTables` y active el flag de exportación aislada:

```json
{
  "migrations": {
    "outputDir": "exports/migrations/lookups",
    "exportOnlyInDataTables": true,
    "dataTables": ["estados", "roles"],
    "disableTableExistsCheck": false
  }
}
```

```bash
dbutility migrations --target sequelize --conn desarrollo
```

Esto produce migraciones de esquema **solo** para `estados` y `roles`, con `disableForeignKeys` automáticamente en `true`, de forma que no existen archivos `add-fks-*` y las migraciones generadas funcionan de forma independiente en cualquier base compatible.

### Generar migraciones y probarlas contra una versión concreta de SQL Server

Si su clúster de producción sigue en SQL Server 2016 pero quiere validar las migraciones para una versión más nueva, como 2019:

```json
{
  "migrations": {
    "backup": true,
    "testDatabase": "2019"
  }
}
```

```bash
dbutility migrations --target sequelize --conn produccion
```

El tipo de base de datos (MSSQL) se detecta desde `database-info.json`, y el runner de pruebas levanta la imagen `mcr.microsoft.com/mssql/server:2019-latest` para la validación.

### Deshabilitar la verificación predeterminada de existencia de tabla (fallo explícito)

Para pipelines de CI que deben fallar cuando las tablas ya existen, desactive la guarda predeterminada:

```bash
dbutility migrations --target typeorm --conn homologacion --disable-table-exists-check
```

o configúrelo en el archivo:

```json
{
  "migrations": {
    "disableTableExistsCheck": true
  }
}
```

## Licencia

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

Ver [LICENSE.es](./LICENSE.es) para más información.

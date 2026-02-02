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
- **Exportación de Modelos**: Exporte tablas de base de datos a modelos de Sequelize, TypeORM y Prisma (Próximamente).
- **Generación de Migraciones**: Cree migraciones a partir de tablas existentes en la base de datos para Sequelize, TypeORM y Prisma (Próximamente).

## Instalación

```bash
npm install @codemastersolutions/db-utility
# o globalmente
npm install -g @codemastersolutions/db-utility
```

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
    "password": "password",
    "database": "mibasedatos",
    "ssl": false
  },
  "connections": {
    "desarrollo": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "username": "root",
      "password": "password",
      "database": "dev_db"
    },
    "produccion": {
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

# Conexión a Base de Datos (Fallback/Base)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=usuario
DB_PASSWORD=password
DB_NAME=mibasedatos
```

## Comandos y Flags de la CLI

> **Nota de Seguridad**: Recomendamos encarecidamente utilizar un usuario de base de datos con permisos de **solo lectura** (SELECT) para realizar operaciones de introspección y exportación. Esto minimiza el riesgo de modificaciones accidentales de datos. La biblioteca DbUtility solo ejecuta consultas de metadatos (estructura de la base de datos) y bloquea comandos que puedan modificar datos o leer filas de tablas de negocio.

### Opciones Globales

| Flag | Descripción |
|------|-------------|
| `--init` | Inicializa el archivo de configuración |
| `-f, --force` | Fuerza la recreación del archivo de configuración si ya existe |
| `-v, --version` | Muestra el número de la versión |
| `-h, --help` | Muestra ayuda para el comando |

### Opciones de Conexión (Disponibles para `connect`, `introspect`, `export`, `migrate`)

| Flag | Descripción |
|------|-------------|
| `--conn <name>` | Nombre de la conexión definida en el archivo de configuración |
| `-c, --config <path>` | Ruta al archivo de configuración |
| `-t, --type <type>` | Tipo de base de datos (`mysql`, `postgres`, `mssql`) |
| `-H, --host <host>` | Host de la base de datos |
| `-P, --port <port>` | Puerto de la base de datos |
| `-u, --username <username>` | Usuario de la base de datos |
| `-p, --password <password>` | Contraseña de la base de datos |
| `-d, --database <database>` | Nombre de la base de datos |
| `--ssl` | Habilita conexión SSL |

### Comandos

#### `connect`

Prueba la conexión con la base de datos.

```bash
dbutility connect [opciones-conexión]
```

#### `introspect`

Realiza introspección en el esquema de la base de datos.

```bash
dbutility introspect [opciones-conexión]
```

#### `export`

Exporta modelos para el ORM objetivo.

```bash
dbutility export --target <orm> [opciones] [opciones-conexión]
```

| Flag | Descripción | Obligatorio |
|------|-------------|-------------|
| `--target <target>` | ORM objetivo (`sequelize`, `typeorm`, `prisma`, `mongoose`) | Sí |
| `--output <dir>` | Directorio de salida | No |

#### `migrations`

Genera migraciones a partir del esquema de la base de datos.

```bash
dbutility migrations --target <orm> [opciones] [opciones-conexión]
```

| Flag | Descripción | Obligatorio |
|------|-------------|-------------|
| `--target <target>` | ORM objetivo (`sequelize`, `typeorm`) | Sí |
| `--output <dir>` | Directorio de salida | No |
| `--data` | Genera migración de datos (seeds) junto con el esquema | No |
| `--only-data` | Genera SOLO migración de datos | No |
| `--tables <tables>` | Lista de tablas separadas por coma para exportación de datos | Sí (si `--data` o `--only-data`) |

#### `test`

Prueba migraciones generadas en contenedores Docker.

```bash
dbutility test --target <orm> [opciones]
```

| Flag | Descripción | Obligatorio |
|------|-------------|-------------|
| `--target <target>` | ORM objetivo (`sequelize`, `typeorm`) | Sí |
| `--dir <dir>` | Directorio conteniendo las migraciones | No |
| `--engines <engines>` | Imágenes Docker para probar (ej: `postgres:14,mysql:8`) | No |
| `--backup` | Exporta backup de la base de datos del contenedor después de la prueba | No |

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
dbutility export --target sequelize --conn desarrollo --output ./src/models
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

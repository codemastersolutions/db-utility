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
  }
}
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

## CLI - Interfaz de Línea de Comandos

> **Nota de Seguridad**: Recomendamos encarecidamente utilizar un usuario de base de datos con permisos de **solo lectura** (SELECT) para realizar operaciones de introspección y exportación. Esto minimiza el riesgo de modificaciones accidentales de datos. La biblioteca DbUtility solo ejecuta consultas de metadatos (estructura de la base de datos) y bloquea comandos que puedan modificar datos o leer filas de tablas de negocio.

DbUtility ofrece una CLI robusta para interactuar con sus bases de datos.

### Conectar a la Base de Datos

Pruebe la conexión a su base de datos.

```bash
dbutility connect -t postgres -H localhost -P 5432 -u usuario -p contraseña -d nombre_base_datos --ssl
```

### Realizar Introspección

Analice el esquema de la base de datos y genere informes de introspección.

```bash
dbutility introspect -t mysql -H localhost -P 3306 -u usuario -p contraseña -d nombre_base_datos
```

### Exportar Modelos

Exporte la estructura de la base de datos a modelos ORM.

```bash
dbutility export --target sequelize --output ./src/models -t postgres ...
```

### Generar Migraciones

Genere migraciones a partir de la estructura existente de la base de datos. Este comando limpia el directorio de salida antes de generar nuevos archivos.

```bash
dbutility migrate --target sequelize --output ./migrations -t postgres ...
```

Opciones:
- `--data`: Genera migraciones de datos (seeds) para las tablas especificadas.
- `--only-data`: Genera SOLO migraciones de datos (seeds).
- `--tables <tables>`: Lista de tablas separadas por comas para exportar datos.

Al usar `--data`, los archivos de seed se generan inmediatamente después de la migración de creación de la tabla correspondiente.

### Probar Migraciones

Pruebe las migraciones generadas utilizando contenedores Docker.

```bash
dbutility test --target sequelize --dir ./migrations/sequelize --engines postgres:14
```

Opciones:
- `--target <target>`: ORM objetivo (sequelize, typeorm).
- `--dir <dir>`: Directorio que contiene las migraciones (opcional).
- `--engines <engines>`: Lista separada por comas de motores de base de datos para probar (ej: postgres:14, mysql:8). Si se omite, intenta leer `database-info.json` generado por el comando migrate.

Requisitos:
- Docker debe estar instalado y en ejecución.

### Opciones de la CLI

- `-t, --type <type>`: Tipo de base de datos (postgres, mysql, mssql)
- `-H, --host <host>`: Host de la base de datos
- `-P, --port <port>`: Puerto de la base de datos
- `-u, --username <username>`: Usuario de la base de datos
- `-p, --password <password>`: Contraseña de la base de datos
- `-d, --database <database>`: Nombre de la base de datos
- `--ssl`: Habilitar SSL (opcional)
- `-c, --config <path>`: Ruta a un archivo de configuración específico

## Licencia

MIT © [CodeMaster Soluções](https://github.com/codemastersolutions)

Ver [LICENSE.es](./LICENSE.es) para más información.

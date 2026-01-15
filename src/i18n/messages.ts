import { AppLanguage } from '../config/AppConfig';

export interface CliMessages {
  appDescription: string;
  connectDescription: string;
  introspectDescription: string;
  exportDescription: string;
  migrateDescription: string;
  initOptionDescription: string;
  forceOptionDescription: string;
  optionConfigPath: string;
  optionType: string;
  optionHost: string;
  optionPort: string;
  optionUsername: string;
  optionPassword: string;
  optionDatabase: string;
  optionSsl: string;
  loadingConfig: string;
  connecting: (dbType: string) => string;
  connectSuccess: string;
  connectionClosed: string;
  connectError: string;
  genericError: string;
  introspectConnecting: (database?: string) => string;
  introspectDone: (tables: number) => string;
  introspectSavedAt: (dir: string) => string;
  exportDevMessage: string;
  migrateDevMessage: string;
  initAlreadyExists: (path: string) => string;
  initCreated: (path: string) => string;
  initRecreated: (path: string) => string;
  securityError: string;
  securitySqlUnsafeOperation: string;
  securitySqlUnsafeDataSelect: string;
  introspectionDbTypeRequired: string;
  introspectionDbTypeUnsupported: string;
  appConfigFileNotFound: (path: string) => string;
  appConfigFileFormatUnsupported: (ext: string) => string;
  configFileNotFound: (path: string) => string;
  configFileFormatUnsupported: (ext: string) => string;
  configDbTypeOrConnectionStringRequired: string;
  configDbTypeRequired: string;
  connectionFailed: string;
}

export interface Messages {
  cli: CliMessages;
}

const ptBrMessages: Messages = {
  cli: {
    appDescription: 'O mais poderoso utilitário de banco de dados.',
    connectDescription: 'Conectar ao banco de dados',
    introspectDescription: 'Realizar introspecção no banco de dados',
    exportDescription: 'Exportar models (Sequelize, TypeORM, Prisma)',
    migrateDescription: 'Gerar migrations a partir do banco de dados',
    initOptionDescription: 'Inicializar arquivo de configuração dbutility.config.json',
    forceOptionDescription: 'Forçar recriação do arquivo de configuração',
    optionConfigPath: 'Caminho para o arquivo de configuração',
    optionType: 'Tipo de banco de dados (mysql, postgres, mssql)',
    optionHost: 'Host do banco de dados',
    optionPort: 'Porta do banco de dados',
    optionUsername: 'Usuário do banco de dados',
    optionPassword: 'Senha do banco de dados',
    optionDatabase: 'Nome do banco de dados',
    optionSsl: 'Habilitar SSL',
    loadingConfig: 'Carregando configuração...',
    connecting: (dbType: string) => `Tentando conectar ao banco de dados ${dbType}...`,
    connectSuccess: '✅ Conexão estabelecida com sucesso!',
    connectionClosed: 'Conexão encerrada.',
    connectError: '❌ Erro ao conectar:',
    genericError: '❌ Erro:',
    introspectConnecting: (database?: string) =>
      `Conectando para introspecção em ${database || '(sem nome)'}...`,
    introspectDone: (tables: number) => `Introspecção concluída. ${tables} tabelas encontradas.`,
    introspectSavedAt: (dir: string) => `Arquivos de introspecção salvos em: ${dir}`,
    exportDevMessage: 'Funcionalidade de exportação em desenvolvimento.',
    migrateDevMessage: 'Funcionalidade de migration em desenvolvimento.',
    initAlreadyExists: (path: string) =>
      `Arquivo de configuração já existe em ${path}. Use --init -f para recriar.`,
    initCreated: (path: string) => `Arquivo de configuração criado com valores padrão em ${path}.`,
    initRecreated: (path: string) =>
      `Arquivo de configuração recriado com valores padrão em ${path}.`,
    securityError: '⚠️ Operação bloqueada por política de segurança:',
    securitySqlUnsafeOperation:
      'Operação SQL não permitida. A DbUtility só executa consultas de metadados.',
    securitySqlUnsafeDataSelect:
      'Leitura de dados de tabelas de negócio não é permitida pela DbUtility.',
    introspectionDbTypeRequired:
      'Tipo de banco de dados é obrigatório para executar a introspecção.',
    introspectionDbTypeUnsupported:
      'Tipo de banco de dados não suportado para introspecção com a DbUtility.',
    appConfigFileNotFound: (path: string) =>
      `Arquivo de configuração da aplicação não encontrado: ${path}`,
    appConfigFileFormatUnsupported: (ext: string) =>
      `Formato de arquivo de configuração da aplicação não suportado: ${ext}`,
    configFileNotFound: (path: string) => `Arquivo de configuração não encontrado: ${path}`,
    configFileFormatUnsupported: (ext: string) => `Formato de arquivo não suportado: ${ext}`,
    configDbTypeOrConnectionStringRequired:
      'Tipo de banco de dados (type) ou connectionString é obrigatório.',
    configDbTypeRequired:
      'Configuração de banco de dados não encontrada. Defina as variáveis de ambiente ou crie um arquivo de configuração.',
    connectionFailed: 'Conexão não estabelecida',
  },
};

const enMessages: Messages = {
  cli: {
    appDescription: 'The most powerful database utility.',
    connectDescription: 'Connect to the database',
    introspectDescription: 'Run database introspection',
    exportDescription: 'Export models (Sequelize, TypeORM, Prisma)',
    migrateDescription: 'Generate migrations from the database',
    initOptionDescription: 'Initialize dbutility.config.json configuration file',
    forceOptionDescription: 'Force recreation of the configuration file',
    optionConfigPath: 'Path to the configuration file',
    optionType: 'Database type (mysql, postgres, mssql)',
    optionHost: 'Database host',
    optionPort: 'Database port',
    optionUsername: 'Database user',
    optionPassword: 'Database password',
    optionDatabase: 'Database name',
    optionSsl: 'Enable SSL',
    loadingConfig: 'Loading configuration...',
    connecting: (dbType: string) => `Trying to connect to ${dbType} database...`,
    connectSuccess: '✅ Connection established successfully!',
    connectionClosed: 'Connection closed.',
    connectError: '❌ Error while connecting:',
    genericError: '❌ Error:',
    introspectConnecting: (database?: string) =>
      `Connecting for introspection on ${database || '(no name)'}...`,
    introspectDone: (tables: number) => `Introspection finished. ${tables} tables found.`,
    introspectSavedAt: (dir: string) => `Introspection files saved at: ${dir}`,
    exportDevMessage: 'Export feature under development.',
    migrateDevMessage: 'Migration feature under development.',
    initAlreadyExists: (path: string) =>
      `Configuration file already exists at ${path}. Use --init -f to recreate it.`,
    initCreated: (path: string) => `Configuration file created with default values at ${path}.`,
    initRecreated: (path: string) => `Configuration file recreated with default values at ${path}.`,
    securityError: '⚠️ Operation blocked by security policy:',
    securitySqlUnsafeOperation:
      'SQL operation not allowed. DbUtility only executes metadata queries.',
    securitySqlUnsafeDataSelect: 'Reading business table data is not allowed by DbUtility.',
    introspectionDbTypeRequired: 'Database type is required to run introspection.',
    introspectionDbTypeUnsupported:
      'Database type is not supported for introspection with DbUtility.',
    appConfigFileNotFound: (path: string) => `Application configuration file not found: ${path}`,
    appConfigFileFormatUnsupported: (ext: string) =>
      `Application configuration file format not supported: ${ext}`,
    configFileNotFound: (path: string) => `Configuration file not found: ${path}`,
    configFileFormatUnsupported: (ext: string) => `File format not supported: ${ext}`,
    configDbTypeOrConnectionStringRequired: 'Database type (type) or connectionString is required.',
    configDbTypeRequired:
      'Database configuration not found. Set environment variables or create a configuration file.',
    connectionFailed: 'Connection not established',
  },
};

const esMessages: Messages = {
  cli: {
    appDescription: 'La utilidad de base de datos más poderosa.',
    connectDescription: 'Conectar a la base de datos',
    introspectDescription: 'Realizar introspección en la base de datos',
    exportDescription: 'Exportar modelos (Sequelize, TypeORM, Prisma)',
    migrateDescription: 'Generar migraciones desde la base de datos',
    initOptionDescription: 'Inicializar el archivo de configuración dbutility.config.json',
    forceOptionDescription: 'Forzar la recreación del archivo de configuración',
    optionConfigPath: 'Ruta al archivo de configuración',
    optionType: 'Tipo de base de datos (mysql, postgres, mssql)',
    optionHost: 'Host de la base de datos',
    optionPort: 'Puerto de la base de datos',
    optionUsername: 'Usuario de la base de datos',
    optionPassword: 'Contraseña de la base de datos',
    optionDatabase: 'Nombre de la base de datos',
    optionSsl: 'Habilitar SSL',
    loadingConfig: 'Cargando configuración...',
    connecting: (dbType: string) => `Intentando conectar a la base de datos ${dbType}...`,
    connectSuccess: '✅ Conexión establecida con éxito.',
    connectionClosed: 'Conexión cerrada.',
    connectError: '❌ Error al conectar:',
    genericError: '❌ Error:',
    introspectConnecting: (database?: string) =>
      `Conectando para introspección en ${database || '(sin nombre)'}...`,
    introspectDone: (tables: number) => `Introspección finalizada. ${tables} tablas encontradas.`,
    introspectSavedAt: (dir: string) => `Archivos de introspección guardados en: ${dir}`,
    exportDevMessage: 'Funcionalidad de exportación en desarrollo.',
    migrateDevMessage: 'Funcionalidad de migraciones en desarrollo.',
    initAlreadyExists: (path: string) =>
      `El archivo de configuración ya existe en ${path}. Usa --init -f para recrearlo.`,
    initCreated: (path: string) =>
      `Archivo de configuración creado con valores predeterminados en ${path}.`,
    initRecreated: (path: string) =>
      `Archivo de configuración recreado con valores predeterminados en ${path}.`,
    securityError: '⚠️ Operación bloqueada por política de seguridad:',
    securitySqlUnsafeOperation:
      'Operación SQL no permitida. DbUtility solo ejecuta consultas de metadatos.',
    securitySqlUnsafeDataSelect:
      'No se permite la lectura de datos de tablas de negocio en DbUtility.',
    introspectionDbTypeRequired:
      'El tipo de base de datos es obligatorio para ejecutar la introspección.',
    introspectionDbTypeUnsupported:
      'Tipo de base de datos no soportado para introspección con DbUtility.',
    appConfigFileNotFound: (path: string) =>
      `Archivo de configuración de la aplicación no encontrado: ${path}`,
    appConfigFileFormatUnsupported: (ext: string) =>
      `Formato de archivo de configuración de la aplicación no soportado: ${ext}`,
    configFileNotFound: (path: string) => `Archivo de configuración no encontrado: ${path}`,
    configFileFormatUnsupported: (ext: string) => `Formato de archivo no soportado: ${ext}`,
    configDbTypeOrConnectionStringRequired:
      'El tipo de base de datos (type) o connectionString es obligatorio.',
    configDbTypeRequired:
      'Configuración de base de datos no encontrada. Defina las variables de entorno o cree un archivo de configuración.',
    connectionFailed: 'Conexión no establecida',
  },
};

export const getMessages = (language: AppLanguage): Messages => {
  if (language === 'en') {
    return enMessages;
  }

  if (language === 'es') {
    return esMessages;
  }

  return ptBrMessages;
};

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  corsOrigin: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  logLevel: string;
}

export function getConfig(): AppConfig {
  return {
    port: parseInt(process.env['PORT'] ?? '3001', 10),
    host: process.env['HOST'] ?? '0.0.0.0',
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    databaseUrl: process.env['DATABASE_URL'] ?? '',
    redisUrl: process.env['REDIS_URL'] ?? '',
    jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-change-me',
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
  };
}

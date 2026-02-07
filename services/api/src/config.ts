import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env file contents into process.env
{
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dirname, '../.env');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // .env file not found, use system environment
  }
}

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  corsOrigin: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  logLevel: string;
  cognito: {
    region: string;
    userPoolId: string;
    clientId: string;
    issuer: string;
    jwksUri: string;
  };
  authSkipVerification: boolean;
  // Labor compliance configuration
  complianceRulesEnabled: boolean;
  openai: {
    apiKey?: string;
    model: string;
  };
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
    cognito: {
      region: process.env['COGNITO_REGION'] ?? 'us-east-1',
      userPoolId: process.env['COGNITO_USER_POOL_ID'] ?? '',
      clientId: process.env['COGNITO_CLIENT_ID'] ?? '',
      issuer: process.env['COGNITO_ISSUER'] ?? '',
      jwksUri: process.env['COGNITO_JWKS_URI'] ?? '',
    },
    authSkipVerification: (process.env['AUTH_SKIP_VERIFICATION'] ?? 'false') === 'true',
    complianceRulesEnabled: (process.env['COMPLIANCE_RULES_ENABLED'] ?? 'false') === 'true',
    openai: {
      apiKey: process.env['OPENAI_API_KEY'],
      model: process.env['OPENAI_MODEL'] ?? 'gpt-4-turbo',
    },
  };
}

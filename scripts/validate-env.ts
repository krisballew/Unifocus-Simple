#!/usr/bin/env node
/**
 * Environment Variable Validation Script
 *
 * Validates that all required environment variables are set and properly formatted.
 * Used during startup to fail fast if configuration is missing or invalid.
 *
 * Usage:
 *   tsx scripts/validate-env.ts          (check API env vars)
 *   WEB_ENV=true tsx scripts/validate-env.ts  (check web env vars)
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - Missing or invalid environment variables
 */

interface EnvVar {
  name: string;
  required: boolean;
  validator?: (value: string) => boolean;
  description: string;
}

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[90m',
};

function log(message: string): void {
  console.log(message);
}

function logError(message: string): void {
  console.error(`${colors.red}✗${colors.reset} ${message}`);
}

function logSuccess(message: string): void {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function logWarning(message: string): void {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function logSection(title: string): void {
  log(`\n${colors.cyan}${title}${colors.reset}`);
  log(colors.dim + '─'.repeat(60) + colors.reset);
}

/**
 * Validate a URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate PostgreSQL connection string
 */
function isValidDatabaseUrl(url: string): boolean {
  return url.startsWith('postgresql://') && url.includes('@') && url.includes('/');
}

/**
 * Validate Cognito pool ID format (region_random)
 */
function isValidCognitoPoolId(poolId: string): boolean {
  return /^[a-z0-9-]+_[a-zA-Z0-9]+$/.test(poolId);
}

/**
 * Validate Cognito client ID format
 */
function isValidCognitoClientId(clientId: string): boolean {
  return /^[a-z0-9]+$/.test(clientId) && clientId.length > 20;
}

/**
 * Validate URI format (should end with .json or path)
 */
function isValidUri(uri: string): boolean {
  return uri.startsWith('https://') && (uri.includes('.json') || uri.includes('/'));
}

/**
 * API environment variables
 */
const apiEnvVars: EnvVar[] = [
  {
    name: 'NODE_ENV',
    required: true,
    validator: (v) => ['production', 'staging', 'development'].includes(v),
    description: 'Must be production, staging, or development',
  },
  {
    name: 'DATABASE_URL',
    required: true,
    validator: isValidDatabaseUrl,
    description: 'PostgreSQL connection string (postgresql://user:pass@host/db)',
  },
  {
    name: 'JWT_SECRET',
    required: true,
    validator: (v) => v.length >= 32,
    description: 'Must be at least 32 characters',
  },
  {
    name: 'COGNITO_REGION',
    required: true,
    validator: (v) => /^[a-z0-9-]+$/.test(v),
    description: 'AWS region (e.g., us-east-1)',
  },
  {
    name: 'COGNITO_USER_POOL_ID',
    required: true,
    validator: isValidCognitoPoolId,
    description: 'User Pool ID format: region_alphanumeric',
  },
  {
    name: 'COGNITO_CLIENT_ID',
    required: true,
    validator: isValidCognitoClientId,
    description: 'Client ID should be 20+ alphanumeric characters',
  },
  {
    name: 'COGNITO_ISSUER',
    required: true,
    validator: isValidUrl,
    description: 'Valid URL to Cognito issuer',
  },
  {
    name: 'COGNITO_JWKS_URI',
    required: true,
    validator: isValidUri,
    description: 'Valid HTTPS URI to JWKS endpoint',
  },
  {
    name: 'CORS_ORIGIN',
    required: false,
    validator: (v) => v.split(',').every(isValidUrl),
    description: 'Comma-separated URLs',
  },
  {
    name: 'PORT',
    required: false,
    validator: (v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0,
    description: 'Positive integer',
  },
  {
    name: 'LOG_LEVEL',
    required: false,
    validator: (v) => ['debug', 'info', 'warn', 'error'].includes(v),
    description: 'Must be debug, info, warn, or error',
  },
];

/**
 * Web environment variables
 */
const webEnvVars: EnvVar[] = [
  {
    name: 'VITE_COGNITO_REGION',
    required: true,
    validator: (v) => /^[a-z0-9-]+$/.test(v),
    description: 'AWS region (e.g., us-east-1)',
  },
  {
    name: 'VITE_COGNITO_USER_POOL_ID',
    required: true,
    validator: isValidCognitoPoolId,
    description: 'User Pool ID format: region_alphanumeric',
  },
  {
    name: 'VITE_COGNITO_CLIENT_ID',
    required: true,
    validator: isValidCognitoClientId,
    description: 'Client ID should be 20+ alphanumeric characters',
  },
  {
    name: 'VITE_COGNITO_DOMAIN',
    required: true,
    validator: (v) => v.includes('.auth.') && v.includes('.amazoncognito.com'),
    description: 'Format: subdomain.auth.region.amazoncognito.com (no https://)',
  },
  {
    name: 'VITE_API_BASE_URL',
    required: true,
    validator: isValidUrl,
    description: 'Valid URL to API',
  },
  {
    name: 'VITE_COGNITO_REDIRECT_URI',
    required: false,
    validator: isValidUrl,
    description: 'Valid URL',
  },
  {
    name: 'VITE_COGNITO_LOGOUT_URI',
    required: false,
    validator: isValidUrl,
    description: 'Valid URL',
  },
];

/**
 * Validate an environment variable
 */
function validateEnvVar(envVar: EnvVar): { valid: boolean; error?: string } {
  const value = process.env[envVar.name];

  // Check if required and missing
  if (!value && envVar.required) {
    return {
      valid: false,
      error: `Required variable ${envVar.name} is not set`,
    };
  }

  // Skip validation if not set and not required
  if (!value) {
    return { valid: true };
  }

  // Validate if validator provided
  if (envVar.validator && !envVar.validator(value)) {
    return {
      valid: false,
      error: `${envVar.name} is invalid: ${envVar.description}`,
    };
  }

  return { valid: true };
}

/**
 * Validate a set of environment variables
 */
function validateEnvironment(envVars: EnvVar[], _context: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const envVar of envVars) {
    const result = validateEnvVar(envVar);

    if (!result.valid && result.error) {
      errors.push(result.error);
    } else if (envVar.required && process.env[envVar.name]) {
      // Show valid required vars
      logSuccess(`${envVar.name} = ${process.env[envVar.name]?.substring(0, 50)}...`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Print validation results
 */
function printResults(result: ValidationResult): void {
  if (result.errors.length > 0) {
    log('');
    for (const error of result.errors) {
      logError(error);
    }
  }

  if (result.warnings.length > 0) {
    log('');
    for (const warning of result.warnings) {
      logWarning(warning);
    }
  }
}

/**
 * Main validation logic
 */
async function main(): Promise<void> {
  const isWebEnv = process.env['WEB_ENV'] === 'true';
  const envVars = isWebEnv ? webEnvVars : apiEnvVars;
  const contextName = isWebEnv ? 'Web Application' : 'API Service';

  logSection(`Validating ${contextName} Environment Variables`);

  const result = validateEnvironment(envVars, contextName);
  printResults(result);

  if (!result.success) {
    log('');
    logError(`${contextName} validation failed`);
    log(
      `${colors.dim}See docs/DEPLOYMENT_DEV.md for required environment variables${colors.reset}`
    );
    process.exit(1);
  }

  log('');
  logSuccess(`All ${contextName} environment variables are valid`);
  process.exit(0);
}

// Run validation
main().catch((error) => {
  logError(`Validation script error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

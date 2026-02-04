import type { FastifyInstance, FastifyRequest } from 'fastify';
import { jwtVerify, importSPKI } from 'jose';
import NodeCache from 'node-cache';

import type { AppConfig } from '../config.js';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    userId: string;
    email: string;
    username: string;
    tenantId?: string;
    roles: string[];
    scopes: string[];
  };
}

// JWKS cache
const jwksCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL

export async function registerAuthPlugin(
  server: FastifyInstance,
  config: AppConfig
): Promise<void> {
  if (config.authSkipVerification) {
    server.log.warn('⚠️  Auth verification is DISABLED for development');
    return;
  }

  if (!config.cognito.issuer || !config.cognito.jwksUri) {
    server.log.warn('Cognito config incomplete, JWT validation will be skipped');
    return;
  }

  // Fetch and cache JWKS
  async function getJWKS(): Promise<Record<string, unknown>> {
    const cached = jwksCache.get<Record<string, unknown>>('jwks');
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(config.cognito.jwksUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
      }
      const jwks = (await response.json()) as Record<string, unknown>;
      jwksCache.set('jwks', jwks);
      return jwks;
    } catch (error) {
      server.log.error({ err: error }, 'Failed to fetch JWKS');
      throw new Error('Failed to fetch JWKS');
    }
  }

  // JWT Verification Hook
  server.addHook('preHandler', async (request, reply) => {
    // Skip auth for health check
    if (request.url === '/health') {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.substring(7);

    try {
      const jwks = await getJWKS();

      // Get the first RSA key from JWKS (Cognito uses RS256)
      const keys = (jwks as { keys: Array<{ alg?: string; use?: string; x5c?: string[] }> }).keys;
      const key = keys.find((k) => k.alg === 'RS256' && k.use === 'sig');
      if (!key || !key.x5c?.[0]) {
        throw new Error('No signing key found in JWKS');
      }

      // Import the public key
      const publicKey = await importSPKI(
        `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`,
        'RS256'
      );

      const verified = await jwtVerify(token, publicKey, {
        issuer: config.cognito.issuer,
        audience: config.cognito.clientId,
      });

      // Extract auth data
      const claims = verified.payload;
      (request as AuthenticatedRequest).user = {
        userId: (claims.sub as string) ?? '',
        email: (claims['email'] as string) ?? '',
        username: (claims['cognito:username'] as string) ?? '',
        tenantId: claims['custom:tenant_id'] as string,
        roles: (claims['cognito:groups'] as string[]) ?? [],
        scopes: (claims['scope'] as string)?.split(' ') ?? [],
      };
    } catch (error) {
      server.log.error({ err: error }, 'JWT verification failed');
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }
  });
}

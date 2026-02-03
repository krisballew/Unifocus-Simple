import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import type { AuthenticatedRequest } from '../plugins/auth';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  correlationId?: string;
}

/**
 * Extract structured logging context from request
 */
function getLoggingContext(request: FastifyRequest) {
  const authRequest = request as AuthenticatedRequest;
  const tenantId =
    (authRequest.user?.tenantId as string) ||
    (request.headers['x-tenant-id'] as string) ||
    undefined;
  const userId =
    (authRequest.user?.userId as string) || (request.headers['x-user-id'] as string) || undefined;

  return {
    correlationId: request.id,
    tenantId,
    userId,
    method: request.method,
    route: request.url,
    remoteAddress: request.ip,
  };
}

async function errorHandlerPlugin(server: FastifyInstance) {
  server.setErrorHandler(
    (error: Error & { statusCode?: number }, request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = error.statusCode ?? 500;
      const loggingContext = getLoggingContext(request);

      // Structured error logging
      server.log.error(
        {
          ...loggingContext,
          statusCode,
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
        },
        'Request error'
      );

      const response: ErrorResponse = {
        statusCode,
        error: error.name ?? 'Error',
        message: error.message ?? 'An unexpected error occurred',
        correlationId: loggingContext.correlationId,
      };

      // Don't expose internal errors in production
      if (statusCode === 500 && server.config.nodeEnv === 'production') {
        response.message = 'Internal server error';
      }

      // Add correlation ID to response headers
      reply
        .header('x-correlation-id', loggingContext.correlationId)
        .status(statusCode)
        .send(response);
    }
  );

  // Add request logging on entry
  server.addHook('onRequest', async (request) => {
    const loggingContext = getLoggingContext(request);

    request.log.info(
      {
        ...loggingContext,
        event: 'request_started',
      },
      'Incoming request'
    );
  });

  // Add response logging on completion
  server.addHook('onResponse', async (request, reply) => {
    const loggingContext = getLoggingContext(request);

    // Convert latency from milliseconds to number if it's a BigInt
    const latencyMs =
      typeof reply.elapsedTime === 'bigint' ? Number(reply.elapsedTime) : (reply.elapsedTime ?? 0);

    request.log.info(
      {
        ...loggingContext,
        statusCode: reply.statusCode,
        latencyMs,
        contentLength: reply.getHeader('content-length'),
        event: 'request_completed',
      },
      'Request completed'
    );

    // Add correlation ID to all responses
    reply.header('x-correlation-id', loggingContext.correlationId);
  });
}

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
});

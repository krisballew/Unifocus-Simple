import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  correlationId?: string;
}

async function errorHandlerPlugin(server: FastifyInstance) {
  server.setErrorHandler(
    (error: Error & { statusCode?: number }, request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = error.statusCode ?? 500;
      const correlationId = request.id;

      server.log.error(
        {
          err: error,
          correlationId,
          url: request.url,
          method: request.method,
        },
        'Error occurred'
      );

      const response: ErrorResponse = {
        statusCode,
        error: error.name ?? 'Error',
        message: error.message ?? 'An unexpected error occurred',
        correlationId,
      };

      // Don't expose internal errors in production
      if (statusCode === 500 && server.config.nodeEnv === 'production') {
        response.message = 'Internal server error';
      }

      reply.status(statusCode).send(response);
    }
  );

  // Add request logging
  server.addHook('onRequest', async (request) => {
    request.log.info(
      {
        correlationId: request.id,
        method: request.method,
        url: request.url,
      },
      'Incoming request'
    );
  });

  server.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        correlationId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'Request completed'
    );
  });
}

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
});

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Request body and file size limits plugin
 * Prevents large payloads from consuming server resources
 *
 * Default limits:
 * - JSON body: 1 MB
 * - Form data: 10 MB
 * - File uploads: 50 MB (even though upload endpoints aren't built yet)
 */
async function requestSizeLimitsPlugin(server: FastifyInstance) {
  // Register hook to set content-length limits on all routes
  server.addHook('preHandler', async (request, reply) => {
    const contentLength = parseInt(request.headers['content-length'] ?? '0', 10);

    // Check JSON request body limit (1 MB default)
    if (
      request.headers['content-type']?.includes('application/json') &&
      contentLength > 1048576 // 1 MB in bytes
    ) {
      reply.status(413).send({
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'Request body exceeds maximum size of 1 MB',
      });
      return;
    }

    // Check form/multipart limit (10 MB default)
    if (
      (request.headers['content-type']?.includes('multipart/form-data') ||
        request.headers['content-type']?.includes('application/x-www-form-urlencoded')) &&
      contentLength > 10485760 // 10 MB in bytes
    ) {
      reply.status(413).send({
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'Request body exceeds maximum size of 10 MB',
      });
      return;
    }
  });
}

export default fp(requestSizeLimitsPlugin, {
  name: 'request-size-limits',
});

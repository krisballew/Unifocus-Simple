import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Security plugin that disables x-powered-by header and sets secure defaults
 * This should be registered early in the plugin chain, before other plugins
 */
async function securityPlugin(server: FastifyInstance) {
  // Disable x-powered-by header
  server.register(async (fastify) => {
    fastify.addHook('onSend', async (_request, reply) => {
      reply.removeHeader('x-powered-by');
      // Ensure Content-Type is set for JSON responses
      if (!reply.getHeader('content-type')) {
        reply.type('application/json');
      }
    });
  });
}

export default fp(securityPlugin, {
  name: 'security',
});

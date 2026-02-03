import { getConfig } from './config';
import { buildServer } from './server';

async function start() {
  const config = getConfig();
  const server = await buildServer(config);

  try {
    await server.listen({ port: config.port, host: config.host });
    server.log.info(`Server listening on http://${config.host}:${config.port}`);
    server.log.info(`OpenAPI documentation available at http://${config.host}:${config.port}/docs`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

start();

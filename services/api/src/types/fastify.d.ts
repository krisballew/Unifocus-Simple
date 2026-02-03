import 'fastify';
import type { AppConfig } from './config';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

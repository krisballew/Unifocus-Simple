import { z } from '@unifocus/contracts';
import type { FastifyInstance } from 'fastify';

const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const LoginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
  }),
});

export async function authRoutes(server: FastifyInstance) {
  server.post(
    '/api/auth/login',
    {
      schema: {
        tags: ['auth'],
        description: 'Login with email and password',
        body: LoginRequestSchema,
        response: {
          200: LoginResponseSchema,
          401: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const { email } = request.body as { email: string; password: string };

      // TODO: Implement real authentication
      // For now, return a mock token
      return {
        token: 'mock-jwt-token',
        user: {
          id: '1',
          email,
          name: 'Demo User',
        },
      };
    }
  );

  server.post(
    '/api/auth/register',
    {
      schema: {
        tags: ['auth'],
        description: 'Register a new user',
        body: z.object({
          email: z.string().email(),
          password: z.string().min(8),
          name: z.string(),
        }),
        response: {
          201: LoginResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, name } = request.body as { email: string; password: string; name: string };

      // TODO: Implement real registration
      // For now, return a mock response
      return reply.status(201).send({
        token: 'mock-jwt-token',
        user: {
          id: '2',
          email,
          name,
        },
      });
    }
  );
}

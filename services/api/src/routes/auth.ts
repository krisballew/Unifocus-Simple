import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import * as authService from '../services/auth-service';

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
    tenantId: z.string(),
  }),
});

const RegisterRequestSchema = z.object({
  inviteToken: z.string(),
  password: z.string().min(8),
});

const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

const PasswordResetConfirmSchema = z.object({
  resetToken: z.string(),
  newPassword: z.string().min(8),
});

export async function authRoutes(server: FastifyInstance) {
  // Login endpoint
  server.post(
    '/api/auth/login',
    {
      schema: {
        tags: ['auth'],
        description: 'Authenticate with email and password',
        body: LoginRequestSchema,
        response: {
          200: LoginResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as z.infer<typeof LoginRequestSchema>;

      try {
        const result = await authService.login(email, password);
        return result;
      } catch (error) {
        return (reply as any).status(401).send({
          error: 'Unauthorized',
          message: error instanceof Error ? error.message : 'Invalid credentials',
        });
      }
    }
  );

  // Complete registration endpoint
  server.post(
    '/api/auth/register',
    {
      schema: {
        tags: ['auth'],
        description: 'Complete registration using invite token',
        body: RegisterRequestSchema,
        response: {
          200: LoginResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { inviteToken, password } = request.body as z.infer<typeof RegisterRequestSchema>;

      try {
        const result = await authService.completeRegistration(inviteToken, password);
        return result;
      } catch (error) {
        return (reply as any).status(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Registration failed',
        });
      }
    }
  );

  // Request password reset
  server.post(
    '/api/auth/password-reset/request',
    {
      schema: {
        tags: ['auth'],
        description: 'Request a password reset email',
        body: PasswordResetRequestSchema,
        response: {
          200: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body as z.infer<typeof PasswordResetRequestSchema>;

      try {
        const resetToken = await authService.requestPasswordReset(email);

        // TODO: Send email with reset link
        // For now, log it to console (dev mode only)
        if (process.env['NODE_ENV'] === 'development') {
          const resetUrl = `${process.env['WEB_LOGIN_URL'] || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
          server.log.info(`Password reset link: ${resetUrl}`);
        }

        // Always return success to prevent email enumeration
        return { message: 'If the email exists, a password reset link has been sent' };
      } catch (error) {
        return { message: 'If the email exists, a password reset link has been sent' };
      }
    }
  );

  // Confirm password reset
  server.post(
    '/api/auth/password-reset/confirm',
    {
      schema: {
        tags: ['auth'],
        description: 'Reset password with token',
        body: PasswordResetConfirmSchema,
        response: {
          200: LoginResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { resetToken, newPassword } = request.body as z.infer<
        typeof PasswordResetConfirmSchema
      >;

      try {
        const result = await authService.resetPassword(resetToken, newPassword);
        return result;
      } catch (error) {
        return (reply as any).status(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Password reset failed',
        });
      }
    }
  );

  // Verify invite token
  server.get(
    '/api/auth/verify-invite/:token',
    {
      schema: {
        tags: ['auth'],
        description: 'Verify if an invite token is valid',
        params: z.object({
          token: z.string(),
        }),
        response: {
          200: z.object({
            valid: z.boolean(),
            email: z.string().optional(),
            name: z.string().optional(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      try {
        const user = await (server as any).prisma.user.findUnique({
          where: { inviteToken: token },
        });

        if (!user || !user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
          return { valid: false };
        }

        return {
          valid: true,
          email: user.email,
          name: user.name,
        };
      } catch (error) {
        return { valid: false };
      }
    }
  );
}

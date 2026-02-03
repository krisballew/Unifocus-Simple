import { type PrismaClient } from '@prisma/client';
import { type FastifyReply } from 'fastify';

export interface IdempotencyContext {
  tenantId: string;
  userId?: string;
  idempotencyKey: string;
  endpoint: string;
}

export interface StoredResponse {
  statusCode: number;
  responseBody: string;
}

/**
 * IdempotencyService handles idempotent requests by storing and replaying responses
 *
 * Idempotency ensures that duplicate requests (with the same idempotency key)
 * return the same response without performing the operation multiple times.
 *
 * Records are stored for 24 hours and automatically expire.
 */
export class IdempotencyService {
  /**
   * Check if an idempotency key has been used before
   * @returns The stored response if found, null otherwise
   */
  static async getStoredResponse(
    prisma: PrismaClient,
    context: IdempotencyContext
  ): Promise<StoredResponse | null> {
    const record = await prisma.idempotencyRecord.findUnique({
      where: {
        tenantId_userId_idempotencyKey_endpoint: {
          tenantId: context.tenantId,
          userId: context.userId || '',
          idempotencyKey: context.idempotencyKey,
          endpoint: context.endpoint,
        },
      },
    });

    if (!record) {
      return null;
    }

    // Check if expired
    if (record.expiresAt < new Date()) {
      // Delete expired record
      await prisma.idempotencyRecord.delete({
        where: { id: record.id },
      });
      return null;
    }

    return {
      statusCode: record.statusCode,
      responseBody: record.responseBody,
    };
  }

  /**
   * Store a response for future replay
   */
  static async storeResponse(
    prisma: PrismaClient,
    context: IdempotencyContext,
    statusCode: number,
    responseBody: unknown
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expire after 24 hours

    await prisma.idempotencyRecord.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        idempotencyKey: context.idempotencyKey,
        endpoint: context.endpoint,
        statusCode,
        responseBody: JSON.stringify(responseBody),
        expiresAt,
      },
    });
  }

  /**
   * Replay a stored response
   */
  static replayResponse(reply: FastifyReply, stored: StoredResponse): void {
    const body = JSON.parse(stored.responseBody);
    reply.status(stored.statusCode).send(body);
  }

  /**
   * Clean up expired idempotency records (should be run periodically)
   */
  static async cleanupExpired(prisma: PrismaClient): Promise<number> {
    const result = await prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}

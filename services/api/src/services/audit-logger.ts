/**
 * Audit logging utility for tracking changes to entities
 */

import { type PrismaClient } from '@prisma/client';

export interface AuditContext {
  tenantId: string;
  userId?: string;
  action: 'created' | 'updated' | 'deleted' | 'approved' | 'rejected';
  entity: string;
  entityId?: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  propertyId?: string;
  departmentId?: string;
  employeeId?: string;
  scheduleId?: string;
  shiftId?: string;
  punchId?: string;
  exceptionId?: string;
}

export class AuditLogger {
  static async log(prisma: PrismaClient, context: AuditContext): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: context.action,
          entity: context.entity,
          changes: context.changes ? JSON.stringify(context.changes) : null,
          propertyId: context.propertyId,
          departmentId: context.departmentId,
          employeeId: context.employeeId,
          scheduleId: context.scheduleId,
          shiftId: context.shiftId,
          punchId: context.punchId,
          exceptionId: context.exceptionId,
        },
      });
    } catch (error) {
      // Log errors but don't fail the operation
      console.error('Failed to create audit log:', error);
    }
  }
}

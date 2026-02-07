import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getAuthContext, hasTenantScope } from '../auth/rbac';

const prisma = new PrismaClient();

export async function employeeRoutes(server: FastifyInstance) {
  const updateEmployeeManagers = async (
    employeeId: string,
    managerIds: string[] | undefined,
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const context = getAuthContext(request);
    if (!hasTenantScope(context)) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Tenant scope required',
      });
    }

    const normalizedManagerIds = (managerIds ?? []).filter(Boolean);

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId: context.tenantId,
      },
    });

    if (!employee) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    if (normalizedManagerIds.some((id) => id === employeeId)) {
      return reply.status(400).send({
        code: 'INVALID_REQUEST',
        message: 'Employee cannot report to themselves',
      });
    }

    if (normalizedManagerIds.length > 0) {
      const managers = await prisma.employee.findMany({
        where: {
          id: { in: normalizedManagerIds },
          tenantId: context.tenantId,
        },
        select: { id: true },
      });

      if (managers.length !== normalizedManagerIds.length) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'One or more managers not found',
        });
      }

      const reciprocal = await prisma.employeeReport.findFirst({
        where: {
          employeeId: { in: normalizedManagerIds },
          managerId: employeeId,
        },
      });

      if (reciprocal) {
        return reply.status(400).send({
          code: 'INVALID_REQUEST',
          message: 'Cannot create circular reporting relationship',
        });
      }
    }

    await prisma.$transaction([
      prisma.employeeReport.deleteMany({
        where: {
          employeeId,
        },
      }),
      ...(normalizedManagerIds.length
        ? [
            prisma.employeeReport.createMany({
              data: normalizedManagerIds.map((managerId) => ({
                employeeId,
                managerId,
                tenantId: context.tenantId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    const updated = await prisma.employee.findFirst({
      where: { id: employeeId },
      include: {
        managerLinks: {
          include: {
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return reply.send({
      data: {
        ...updated,
        managers: updated?.managerLinks.map((link) => link.manager) ?? [],
        managerIds: updated?.managerLinks.map((link) => link.managerId) ?? [],
      },
    });
  };

  // GET /employees - List employees for tenant (optional property filter)
  server.get('/employees', async (request, reply) => {
    const context = getAuthContext(request);
    if (!hasTenantScope(context)) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Tenant scope required',
      });
    }

    const { propertyId, active } = request.query as {
      propertyId?: string;
      active?: string;
    };

    const employees = await prisma.employee.findMany({
      where: {
        tenantId: context.tenantId,
        ...(propertyId ? { propertyId } : {}),
        ...(active ? { isActive: active === 'true' } : {}),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
          },
        },
        managerLinks: {
          include: {
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 200,
    });

    const formattedEmployees = employees.map((employee) => {
      const employmentDetails = (employee.employmentDetails as Record<string, unknown>) || {};
      return {
        ...employee,
        employmentStatus: employmentDetails.employmentStatus || 'active',
        terminationDate: employmentDetails.terminationDate,
        terminationReason: employmentDetails.terminationReason,
        employmentStatusChangedOn: employmentDetails.employmentStatusChangedOn,
        employmentStatusChangedBy: employmentDetails.employmentStatusChangedBy,
        managers: employee.managerLinks.map((link) => link.manager),
        managerIds: employee.managerLinks.map((link) => link.managerId),
      };
    });

    return reply.send({ data: formattedEmployees });
  });

  // POST /employees - Create employee profile
  server.post('/employees', async (request, reply) => {
    const context = getAuthContext(request);
    if (!hasTenantScope(context)) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: 'Tenant scope required',
      });
    }

    const payload = request.body as {
      propertyId?: string;
      firstName?: string;
      lastName?: string;
      email?: string | null;
      phone?: string | null;
      hireDate?: string | null;
    };

    if (!payload.propertyId || !payload.firstName || !payload.lastName) {
      return reply.status(400).send({
        code: 'INVALID_REQUEST',
        message: 'propertyId, firstName, and lastName are required',
      });
    }

    const property = await prisma.property.findFirst({
      where: {
        id: payload.propertyId,
        tenantId: context.tenantId,
      },
    });

    if (!property) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Property not found',
      });
    }

    const employeeRole = await prisma.role.findFirst({
      where: { name: 'Employee' },
      select: { id: true },
    });

    if (!employeeRole) {
      return reply.status(500).send({
        code: 'ROLE_NOT_FOUND',
        message: 'Employee role not found. Please seed roles.',
      });
    }

    const employee = await prisma.$transaction(async (tx) => {
      const createdEmployee = await tx.employee.create({
        data: {
          tenantId: context.tenantId ?? '',
          propertyId: payload.propertyId as string,
          firstName: payload.firstName as string,
          lastName: payload.lastName as string,
          email: payload.email ?? null,
          phone: payload.phone ?? null,
          hireDate: payload.hireDate ? new Date(payload.hireDate) : null,
          isActive: true,
        },
      });

      if (payload.email) {
        const existingUser = await tx.user.findFirst({
          where: {
            tenantId: context.tenantId ?? '',
            email: payload.email,
          },
        });

        const user = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                name: `${payload.firstName} ${payload.lastName}`.trim(),
                propertyId: existingUser.propertyId ?? payload.propertyId,
                isActive: true,
              },
            })
          : await tx.user.create({
              data: {
                tenantId: context.tenantId ?? '',
                propertyId: payload.propertyId,
                email: payload.email,
                name: `${payload.firstName} ${payload.lastName}`.trim(),
                isActive: true,
              },
            });

        await tx.userRoleAssignment.createMany({
          data: [
            {
              tenantId: context.tenantId ?? '',
              userId: user.id,
              roleId: employeeRole.id,
              propertyId: payload.propertyId,
            },
          ],
          skipDuplicates: true,
        });
      }

      return createdEmployee;
    });

    return reply.status(201).send({ data: employee });
  });

  // PATCH /api/employees/:employeeId - Update employee profile
  server.patch<{ Params: { employeeId: string } }>(
    '/employees/:employeeId',
    async (request, reply) => {
      const context = getAuthContext(request);
      if (!hasTenantScope(context)) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Tenant scope required',
        });
      }

      const { employeeId } = request.params;
      const payload = request.body as {
        firstName?: string;
        lastName?: string;
        email?: string | null;
        phone?: string | null;
        hireDate?: string | null;
        isActive?: boolean;
        employmentStatus?: string;
        terminationDate?: string;
        terminationReason?: string;
        employmentStatusChangedBy?: string;
      };

      const existing = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          tenantId: context.tenantId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Employee not found',
        });
      }

      const employee = await prisma.$transaction(async (tx) => {
        // Merge employment details if status-related fields are provided
        let updatedEmploymentDetails =
          (existing.employmentDetails as Record<string, unknown>) || {};
        if (payload.employmentStatus || payload.terminationDate || payload.terminationReason) {
          updatedEmploymentDetails = {
            ...updatedEmploymentDetails,
            ...(payload.employmentStatus && { employmentStatus: payload.employmentStatus }),
            ...(payload.terminationDate && { terminationDate: payload.terminationDate }),
            ...(payload.terminationReason && { terminationReason: payload.terminationReason }),
            ...(payload.employmentStatus && {
              employmentStatusChangedOn: new Date().toISOString(),
              employmentStatusChangedBy:
                payload.employmentStatusChangedBy || context.userId || 'Unknown',
            }),
          };
        }

        const updatedEmployee = await tx.employee.update({
          where: { id: employeeId },
          data: {
            firstName: payload.firstName ?? existing.firstName,
            lastName: payload.lastName ?? existing.lastName,
            email: payload.email ?? existing.email,
            phone: payload.phone ?? existing.phone,
            hireDate: payload.hireDate ? new Date(payload.hireDate) : existing.hireDate,
            isActive: payload.isActive ?? existing.isActive,
            employmentDetails: (payload.employmentStatus ||
            payload.terminationDate ||
            payload.terminationReason
              ? updatedEmploymentDetails
              : existing.employmentDetails) as Prisma.InputJsonValue,
          },
        });

        if (payload.isActive === true && updatedEmployee.email) {
          await tx.user.updateMany({
            where: {
              tenantId: context.tenantId,
              email: updatedEmployee.email,
            },
            data: { isActive: true },
          });
        }

        return updatedEmployee;
      });

      return reply.send({ data: employee });
    }
  );

  // PATCH /employees/:employeeId/deactivate - Deactivate employee profile
  server.patch<{ Params: { employeeId: string } }>(
    '/employees/:employeeId/deactivate',
    async (request, reply) => {
      const context = getAuthContext(request);
      if (!hasTenantScope(context)) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Tenant scope required',
        });
      }

      const { employeeId } = request.params;
      const existing = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          tenantId: context.tenantId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Employee not found',
        });
      }

      const employee = await prisma.$transaction(async (tx) => {
        const updatedEmployee = await tx.employee.update({
          where: { id: employeeId },
          data: { isActive: false },
        });

        if (updatedEmployee.email) {
          await tx.user.updateMany({
            where: {
              tenantId: context.tenantId,
              email: updatedEmployee.email,
            },
            data: { isActive: false },
          });
        }

        return updatedEmployee;
      });

      return reply.send({ data: employee });
    }
  );

  // PUT /api/employees/:employeeId/managers - Update employee's managers
  server.put<{ Params: { employeeId: string }; Body: Prisma.InputJsonValue }>(
    '/employees/:employeeId/managers',
    async (request, reply) => {
      const { employeeId } = request.params;
      const { managerIds } = request.body as { managerIds?: string[] };
      return updateEmployeeManagers(employeeId, managerIds, request, reply);
    }
  );

  // PUT /employees/:employeeId/manager - Backward-compatible single manager update
  server.put<{ Params: { employeeId: string }; Body: Prisma.InputJsonValue }>(
    '/employees/:employeeId/manager',
    async (request, reply) => {
      const { managerId } = request.body as { managerId?: string | null };
      return updateEmployeeManagers(
        request.params.employeeId,
        managerId ? [managerId] : [],
        request,
        reply
      );
    }
  );

  // GET /employees/:employeeId/employment-details - Get employment details
  server.get<{ Params: { employeeId: string } }>(
    '/employees/:employeeId/employment-details',
    async (request, reply) => {
      const { employeeId } = request.params;
      const context = getAuthContext(request);

      if (!hasTenantScope(context)) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Tenant scope required',
        });
      }

      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          tenantId: context.tenantId,
        },
      });

      if (!employee) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Employee not found',
        });
      }

      return reply.send({
        data: {
          employmentDetails: employee.employmentDetails || {},
        },
      });
    }
  );

  // PUT /employees/:employeeId/employment-details - Save/update employment details
  server.put<{ Params: { employeeId: string } }>(
    '/employees/:employeeId/employment-details',
    async (request, reply) => {
      const { employeeId } = request.params;
      const employmentDetailsPayload = request.body as Prisma.InputJsonValue;
      const context = getAuthContext(request);

      if (!hasTenantScope(context)) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Tenant scope required',
        });
      }

      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          tenantId: context.tenantId,
        },
      });

      if (!employee) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Employee not found',
        });
      }

      const updatedEmployee = await prisma.employee.update({
        where: { id: employeeId },
        data: {
          employmentDetails: employmentDetailsPayload,
        },
      });

      return reply.send({
        data: updatedEmployee,
      });
    }
  );
}

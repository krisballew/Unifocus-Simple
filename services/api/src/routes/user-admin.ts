import { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getAuthContext, hasRole } from '../auth/rbac';
import { generateToken } from '../services/auth-service.js';
import { sendInviteEmail } from '../services/invite-email.js';

const prisma = new PrismaClient();

interface UpdateRolesBody {
  roles: string[];
}

interface CreateUserBody {
  name: string;
  email: string;
  roles?: string[];
}

interface UpdateUserStatusBody {
  isActive: boolean;
}

const VALID_ROLES = [
  'Platform Administrator',
  'Property Administrator',
  'HR Manager',
  'Department Manager',
  'Employee',
];

const ROLE_HIERARCHY = {
  'Platform Administrator': 5,
  'Property Administrator': 4,
  'HR Manager': 4,
  'Department Manager': 3,
  Employee: 1,
};

export async function userAdminRoutes(server: FastifyInstance) {
  // POST /api/users - Create new user
  server.post(
    '/users',
    async (request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) => {
      try {
        const authContext = getAuthContext(request);
        if (!authContext) {
          return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
        }

        const { roles: currentUserRoles, tenantId, userId: currentUserId } = authContext;
        const { name, email, roles } = request.body;

        if (!name?.trim() || !email?.trim()) {
          return reply.status(400).send({
            code: 'INVALID_INPUT',
            message: 'Name and email are required',
          });
        }

        const hasAdminAccess =
          hasRole(authContext, 'Platform Administrator') ||
          hasRole(authContext, 'Property Administrator') ||
          hasRole(authContext, 'HR Manager');

        if (!hasAdminAccess) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to create users',
          });
        }

        const requestedRoles = roles && roles.length > 0 ? roles : ['Employee'];

        const invalidRoles = requestedRoles.filter((role) => !VALID_ROLES.includes(role));
        if (invalidRoles.length > 0) {
          return reply.status(400).send({
            code: 'INVALID_ROLES',
            message: `Invalid roles: ${invalidRoles.join(', ')}`,
          });
        }

        const currentUserMaxLevel = Math.max(
          ...currentUserRoles.map(
            (role) => ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] || 0
          )
        );

        for (const role of requestedRoles) {
          const roleLevel = ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY];
          if (roleLevel > currentUserMaxLevel) {
            return reply.status(403).send({
              code: 'INSUFFICIENT_PERMISSIONS',
              message: `You cannot grant the role "${role}" as it exceeds your permission level`,
            });
          }
        }

        const roleRecords = await prisma.role.findMany({
          where: {
            name: {
              in: requestedRoles,
            },
          },
        });

        if (roleRecords.length !== requestedRoles.length) {
          const foundRoleNames = roleRecords.map((r) => r.name);
          const missingRoles = requestedRoles.filter((r) => !foundRoleNames.includes(r));
          return reply.status(400).send({
            code: 'ROLES_NOT_FOUND',
            message: `Roles not found in database: ${missingRoles.join(', ')}. Please ensure roles are seeded.`,
          });
        }

        const createdUser = await prisma.$transaction(async (tx) => {
          // Generate invite token
          const inviteToken = generateToken();
          const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

          const user = await tx.user.create({
            data: {
              tenantId: tenantId ?? 'unknown',
              email: email.trim().toLowerCase(),
              name: name.trim(),
              isActive: true,
              inviteToken,
              inviteTokenExpiry,
            },
          });

          await tx.userRoleAssignment.createMany({
            data: roleRecords.map((role) => ({
              userId: user.id,
              roleId: role.id,
              tenantId: user.tenantId,
              isActive: true,
            })),
          });

          return user;
        });

        const invitePayload = await sendInviteEmail({
          name: createdUser.name,
          email: createdUser.email,
          roles: requestedRoles,
          inviteToken: createdUser.inviteToken!,
        });

        server.log.info(
          `User ${currentUserId} created user ${createdUser.id} (${createdUser.email}) with roles: ${requestedRoles.join(', ')}`
        );

        return reply.status(201).send({
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          tenantId: createdUser.tenantId,
          status: createdUser.isActive ? 'active' : 'inactive',
          createdAt: createdUser.createdAt,
          roles: requestedRoles,
          invite: invitePayload,
        });
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error) {
          const prismaError = error as { code?: string };
          if (prismaError.code === 'P2002') {
            return reply.status(409).send({
              code: 'USER_EXISTS',
              message: 'A user with that email already exists',
            });
          }
        }

        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create user',
        });
      }
    }
  );

  // PATCH /api/users/:userId/status - Activate/deactivate user
  server.patch(
    '/users/:userId/status',
    async (
      request: FastifyRequest<{ Params: { userId: string }; Body: UpdateUserStatusBody }>,
      reply: FastifyReply
    ) => {
      try {
        const authContext = getAuthContext(request);
        if (!authContext) {
          return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
        }

        const { userId } = request.params;
        const { isActive } = request.body;

        if (authContext.userId === userId) {
          return reply.status(400).send({
            code: 'INVALID_ACTION',
            message: 'You cannot change your own active status',
          });
        }

        const hasAdminAccess =
          hasRole(authContext, 'Platform Administrator') ||
          hasRole(authContext, 'Property Administrator') ||
          hasRole(authContext, 'HR Manager');

        if (!hasAdminAccess) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to update user status',
          });
        }

        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!targetUser) {
          return reply.status(404).send({
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          });
        }

        if (
          !hasRole(authContext, 'Platform Administrator') &&
          authContext.tenantId &&
          targetUser.tenantId !== authContext.tenantId
        ) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'You cannot update users outside your tenant',
          });
        }

        const updated = await prisma.user.update({
          where: { id: userId },
          data: { isActive },
          select: {
            id: true,
            email: true,
            name: true,
            tenantId: true,
            isActive: true,
            createdAt: true,
          },
        });

        server.log.info(
          `User ${authContext.userId} updated status for user ${userId} to: ${isActive ? 'active' : 'inactive'}`
        );

        return reply.send({
          id: updated.id,
          email: updated.email,
          name: updated.name,
          tenantId: updated.tenantId,
          status: updated.isActive ? 'active' : 'inactive',
          createdAt: updated.createdAt,
        });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user status',
        });
      }
    }
  );

  // POST /api/users/:userId/invite - Resend invite email
  server.post(
    '/users/:userId/invite',
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      try {
        const authContext = getAuthContext(request);
        if (!authContext) {
          return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
        }

        const { userId } = request.params;

        const hasAdminAccess =
          hasRole(authContext, 'Platform Administrator') ||
          hasRole(authContext, 'Property Administrator') ||
          hasRole(authContext, 'HR Manager');

        if (!hasAdminAccess) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to resend invites',
          });
        }

        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            roleAssignments: {
              where: { isActive: true },
              include: { role: true },
            },
          },
        });

        if (!targetUser) {
          return reply.status(404).send({
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          });
        }

        if (
          !hasRole(authContext, 'Platform Administrator') &&
          authContext.tenantId &&
          targetUser.tenantId !== authContext.tenantId
        ) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'You cannot resend invites outside your tenant',
          });
        }

        const roles = targetUser.roleAssignments.map((ra) => ra.role.name);
        const invitePayload = await sendInviteEmail({
          name: targetUser.name,
          email: targetUser.email,
          roles,
        });

        server.log.info(`User ${authContext.userId} resent invite to ${targetUser.email}`);

        return reply.send({
          id: targetUser.id,
          email: targetUser.email,
          invite: invitePayload,
        });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resend invite',
        });
      }
    }
  );
  // GET /api/users - List all users with role filtering
  server.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authContext = getAuthContext(request);
      if (!authContext) {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      const { tenantId } = authContext;

      // Check permissions - Platform Admin, Property Admin, HR Manager, or Department Manager
      const hasAdminAccess =
        hasRole(authContext, 'Platform Administrator') ||
        hasRole(authContext, 'Property Administrator') ||
        hasRole(authContext, 'HR Manager') ||
        hasRole(authContext, 'Department Manager');

      if (!hasAdminAccess) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to view users',
        });
      }

      // Build query based on role
      const whereClause: Record<string, unknown> = {};

      if (!hasRole(authContext, 'Platform Administrator')) {
        // Non-platform admins can only see users in their tenant
        whereClause.tenantId = tenantId;
      }

      const users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          tenantId: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          roleAssignments: {
            where: {
              isActive: true,
            },
            select: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      // Transform to include roles array
      const transformedUsers = users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        status: user.isActive ? 'active' : 'inactive',
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        roles: user.roleAssignments.map((ra) => ra.role.name),
      }));

      // For department managers, filter to show only employees
      if (
        hasRole(authContext, 'Department Manager') &&
        !hasRole(authContext, 'Platform Administrator') &&
        !hasRole(authContext, 'Property Administrator') &&
        !hasRole(authContext, 'HR Manager')
      ) {
        const filteredUsers = transformedUsers.filter(
          (user) => user.roles.length === 1 && user.roles.includes('Employee')
        );
        return reply.send(filteredUsers);
      }

      return reply.send(transformedUsers);
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch users',
      });
    }
  });

  // PUT /api/users/:userId/roles - Update user roles
  server.put(
    '/users/:userId/roles',
    async (
      request: FastifyRequest<{ Params: { userId: string }; Body: UpdateRolesBody }>,
      reply: FastifyReply
    ) => {
      try {
        const authContext = getAuthContext(request);
        if (!authContext) {
          return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
        }

        const { roles: currentUserRoles } = authContext;
        const { userId } = request.params;
        const { roles: newRoles } = request.body;

        // Validate roles
        const invalidRoles = newRoles.filter((role) => !VALID_ROLES.includes(role));
        if (invalidRoles.length > 0) {
          return reply.status(400).send({
            code: 'INVALID_ROLES',
            message: `Invalid roles: ${invalidRoles.join(', ')}`,
          });
        }

        // Ensure at least Employee role
        if (newRoles.length === 0) {
          return reply.status(400).send({
            code: 'INVALID_ROLES',
            message: 'User must have at least the Employee role',
          });
        }

        // Get current user's max role level
        const currentUserMaxLevel = Math.max(
          ...currentUserRoles.map(
            (role) => ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] || 0
          )
        );

        // Check if user is trying to grant roles above their level
        for (const role of newRoles) {
          const roleLevel = ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY];
          if (roleLevel > currentUserMaxLevel) {
            return reply.status(403).send({
              code: 'INSUFFICIENT_PERMISSIONS',
              message: `You cannot grant the role "${role}" as it exceeds your permission level`,
            });
          }
        }

        // Check if current user has permission to modify roles
        const hasAdminAccess =
          hasRole(authContext, 'Platform Administrator') ||
          hasRole(authContext, 'Property Administrator') ||
          hasRole(authContext, 'HR Manager');

        if (!hasAdminAccess) {
          return reply.status(403).send({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to modify user roles',
          });
        }

        // Update user roles
        // First, get the target user and their current role assignments
        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            roleAssignments: {
              where: { isActive: true },
              include: {
                role: true,
              },
            },
          },
        });

        if (!targetUser) {
          return reply.status(404).send({
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          });
        }

        // Get all role records for the new roles
        const roleRecords = await prisma.role.findMany({
          where: {
            name: {
              in: newRoles,
            },
          },
        });

        if (roleRecords.length !== newRoles.length) {
          const foundRoleNames = roleRecords.map((r) => r.name);
          const missingRoles = newRoles.filter((r) => !foundRoleNames.includes(r));
          return reply.status(400).send({
            code: 'ROLES_NOT_FOUND',
            message: `Roles not found in database: ${missingRoles.join(', ')}. Please ensure roles are seeded.`,
          });
        }

        // Deactivate all current role assignments
        await prisma.userRoleAssignment.updateMany({
          where: {
            userId: userId,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });

        // Create new role assignments
        await prisma.userRoleAssignment.createMany({
          data: roleRecords.map((role) => ({
            userId: userId,
            roleId: role.id,
            tenantId: targetUser.tenantId,
            isActive: true,
          })),
        });

        // Fetch updated user with new roles
        const updatedUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            tenantId: true,
            isActive: true,
            createdAt: true,
            roleAssignments: {
              where: {
                isActive: true,
              },
              select: {
                role: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });

        // Transform response
        const response = {
          id: updatedUser!.id,
          email: updatedUser!.email,
          name: updatedUser!.name,
          tenantId: updatedUser!.tenantId,
          status: updatedUser!.isActive ? 'active' : 'inactive',
          createdAt: updatedUser!.createdAt,
          roles: updatedUser!.roleAssignments.map((ra) => ra.role.name),
        };

        server.log.info(
          `User ${authContext.userId} updated roles for user ${userId} to: ${newRoles.join(', ')}`
        );

        return reply.send(response);
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user roles',
        });
      }
    }
  );
}

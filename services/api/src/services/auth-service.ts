import { randomBytes } from 'crypto';

import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    roleAssignments: {
      include: {
        role: true;
      };
    };
  };
}>;

const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key-change-in-production';
// const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '7d';

export interface CreateUserOptions {
  email: string;
  name: string;
  tenantId: string;
  roleIds: string[];
  propertyId?: string;
  departmentId?: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    tenantId: string;
  };
}

/**
 * Generate a secure random token for invites/password resets
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateJWT(userId: string, tenantId: string): string {
  // In a real implementation, use jsonwebtoken library
  // For now, create a simple mock token
  const payload = {
    userId,
    tenantId,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  // Mock JWT format: header.payload.signature
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from(`${header}.${payloadStr}.${JWT_SECRET}`).toString('base64url');

  return `${header}.${payloadStr}.${signature}`;
}

/**
 * Create a new user with an invite token
 */
export async function createUserWithInvite(
  options: CreateUserOptions
): Promise<{ user: UserWithRoles; inviteToken: string }> {
  const inviteToken = generateToken();
  const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const user = await prisma.user.create({
    data: {
      email: options.email,
      name: options.name,
      tenantId: options.tenantId,
      propertyId: options.propertyId,
      departmentId: options.departmentId,
      inviteToken,
      inviteTokenExpiry,
      password: null, // Will be set when they complete registration
      roleAssignments: {
        create: options.roleIds.map((roleId) => ({
          roleId,
          tenantId: options.tenantId,
          propertyId: options.propertyId || null,
          departmentId: options.departmentId || null,
        })),
      },
    },
    include: {
      roleAssignments: {
        include: {
          role: true,
        },
      },
    },
  });

  return { user, inviteToken };
}

/**
 * Complete user registration by setting password
 */
export async function completeRegistration(
  inviteToken: string,
  password: string
): Promise<LoginResult> {
  // Find user by invite token
  const user = await prisma.user.findUnique({
    where: { inviteToken },
  });

  if (!user) {
    throw new Error('Invalid or expired invite token');
  }

  if (user.inviteTokenExpiry && user.inviteTokenExpiry < new Date()) {
    throw new Error('Invite token has expired');
  }

  // Hash password and clear invite token
  const hashedPassword = await hashPassword(password);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      inviteToken: null,
      inviteTokenExpiry: null,
    },
  });

  // Generate JWT token
  const token = generateJWT(updatedUser.id, updatedUser.tenantId);

  return {
    token,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      tenantId: updatedUser.tenantId,
    },
  };
}

/**
 * Authenticate a user with email/password
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  // Find user by email
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (!user.password) {
    throw new Error('Please complete your registration first');
  }

  if (!user.isActive) {
    throw new Error('Your account has been deactivated');
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password);

  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Generate JWT token
  const token = generateJWT(user.id, user.tenantId);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
    },
  };
}

/**
 * Request a password reset
 */
export async function requestPasswordReset(email: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    // Don't reveal if email exists
    return 'reset-token';
  }

  const resetToken = generateToken();
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpiry,
    },
  });

  return resetToken;
}

/**
 * Reset password with token
 */
export async function resetPassword(resetToken: string, newPassword: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { resetToken },
  });

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
    throw new Error('Reset token has expired');
  }

  // Hash password and clear reset token
  const hashedPassword = await hashPassword(newPassword);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  // Generate JWT token
  const token = generateJWT(updatedUser.id, updatedUser.tenantId);

  return {
    token,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      tenantId: updatedUser.tenantId,
    },
  };
}

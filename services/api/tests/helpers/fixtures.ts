import { PrismaClient } from '@prisma/client';

/**
 * Test fixtures helper
 * Provides reusable factory functions for creating test data with all required fields
 */

/**
 * Create or get a test Division for a tenant/property
 * Creates a new division if it doesn't exist, otherwise returns existing
 */
export async function getOrCreateDivision(
  prisma: PrismaClient,
  tenantId: string,
  propertyId: string,
  name = 'Test Division'
): Promise<{ id: string }> {
  const existing = await prisma.division.findFirst({
    where: {
      tenantId,
      propertyId,
      name,
    },
  });

  if (existing) {
    return existing;
  }

  return await prisma.division.create({
    data: {
      tenantId,
      propertyId,
      name,
    },
  });
}

/**
 * Create or get a test DepartmentCategory for a tenant
 * Creates a new category if it doesn't exist, otherwise returns existing
 */
export async function getOrCreateDepartmentCategory(
  prisma: PrismaClient,
  tenantId: string,
  name = 'Test Department Category'
): Promise<{ id: string }> {
  const existing = await prisma.departmentCategory.findFirst({
    where: {
      tenantId,
      name,
    },
  });

  if (existing) {
    return existing;
  }

  return await prisma.departmentCategory.create({
    data: {
      tenantId,
      name,
      isActive: true,
    },
  });
}

/**
 * Create or get a test JobCategory for a tenant
 * Creates a new category if it doesn't exist, otherwise returns existing
 */
export async function getOrCreateJobCategory(
  prisma: PrismaClient,
  tenantId: string,
  name = 'Test Job Category'
): Promise<{ id: string }> {
  const existing = await prisma.jobCategory.findFirst({
    where: {
      tenantId,
      name,
    },
  });

  if (existing) {
    return existing;
  }

  return await prisma.jobCategory.create({
    data: {
      tenantId,
      name,
      isActive: true,
    },
  });
}

/**
 * Create a test Department with all required fields
 * Automatically creates Division and DepartmentCategory if not provided
 */
export async function createTestDepartment(
  prisma: PrismaClient,
  data: {
    tenantId: string;
    propertyId: string;
    name: string;
    divisionId?: string;
    departmentCategoryId?: string;
    level?: string;
    parentId?: string | null;
  }
): Promise<{
  id: string;
  tenantId: string;
  propertyId: string;
  divisionId: string;
  departmentCategoryId: string;
  name: string;
}> {
  // Get or create division if not provided
  const divisionId =
    data.divisionId ||
    (await getOrCreateDivision(prisma, data.tenantId, data.propertyId)).id;

  // Get or create department category if not provided
  const departmentCategoryId =
    data.departmentCategoryId ||
    (await getOrCreateDepartmentCategory(prisma, data.tenantId)).id;

  return await prisma.department.create({
    data: {
      tenantId: data.tenantId,
      propertyId: data.propertyId,
      divisionId,
      departmentCategoryId,
      name: data.name,
    },
  });
}

/**
 * Create a test JobRole with all required fields
 * Automatically creates JobCategory and Department if not provided
 */
export async function createTestJobRole(
  prisma: PrismaClient,
  data: {
    tenantId: string;
    propertyId: string;
    name: string;
    departmentId?: string;
    jobCategoryId?: string;
  }
): Promise<{
  id: string;
  tenantId: string;
  propertyId: string;
  departmentId: string;
  jobCategoryId: string;
  name: string;
}> {
  // Get or create department if not provided
  const departmentId = data.departmentId
    ? data.departmentId
    : (
        await createTestDepartment(prisma, {
          tenantId: data.tenantId,
          propertyId: data.propertyId,
          name: 'Test Department',
        })
      ).id;

  // Get or create job category if not provided
  const jobCategoryId =
    data.jobCategoryId || (await getOrCreateJobCategory(prisma, data.tenantId)).id;

  return await prisma.jobRole.create({
    data: {
      tenantId: data.tenantId,
      propertyId: data.propertyId,
      departmentId,
      jobCategoryId,
      name: data.name,
      isActive: true,
    },
  });
}


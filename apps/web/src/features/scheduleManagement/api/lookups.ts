/**
 * Schedule Management Lookups API
 * Typed functions for fetching departments, job roles, and employees
 */

import { getApiClient } from '../../../services/api-client';

// ========== Types ==========

export interface DepartmentLookup {
  id: string;
  name: string;
  code?: string;
}

export interface JobRoleLookup {
  id: string;
  name: string;
  code?: string;
}

export interface EmployeeLookup {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber?: string;
  email?: string;
  displayName?: string;
}

// ========== Parameters ==========

export interface GetDepartmentsParams {
  propertyId: string;
}

export interface GetJobRolesParams {
  propertyId: string;
  departmentId?: string;
}

export interface GetEmployeesParams {
  propertyId: string;
  departmentId?: string;
  q?: string;
}

// ========== API Functions ==========

/**
 * Get departments for a property
 */
export async function getDepartments(params: GetDepartmentsParams): Promise<DepartmentLookup[]> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({
    propertyId: params.propertyId,
  });

  const response = await client.get<{ success: boolean; data: DepartmentLookup[] }>(
    `/api/scheduling/v2/lookups/departments?${queryParams.toString()}`
  );

  return response.data || [];
}

/**
 * Get job roles for a property, optionally filtered by department
 */
export async function getJobRoles(params: GetJobRolesParams): Promise<JobRoleLookup[]> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({
    propertyId: params.propertyId,
    ...(params.departmentId && { departmentId: params.departmentId }),
  });

  const response = await client.get<{ success: boolean; data: JobRoleLookup[] }>(
    `/api/scheduling/v2/lookups/job-roles?${queryParams.toString()}`
  );

  return response.data || [];
}

/**
 * Get employees for a property, optionally filtered by department and search query
 */
export async function getEmployees(params: GetEmployeesParams): Promise<EmployeeLookup[]> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({
    propertyId: params.propertyId,
    ...(params.departmentId && { departmentId: params.departmentId }),
    ...(params.q && { q: params.q }),
  });

  const response = await client.get<{ success: boolean; data: EmployeeLookup[] }>(
    `/api/scheduling/v2/lookups/employees?${queryParams.toString()}`
  );

  return response.data || [];
}

/**
 * Shifts API Module
 * Typed functions for shift management endpoints
 */

import { getApiClient } from '../../../services/api-client';

// ========== Types ==========

export interface Shift {
  id: string;
  tenantId: string;
  propertyId: string;
  schedulePeriodId: string;
  departmentId: string;
  jobRoleId: string;
  startDateTime: string; // ISO datetime
  endDateTime: string; // ISO datetime
  breakMinutes: number;
  isOpenShift: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  assignments?: ShiftAssignment[];
  department?: { id: string; name: string };
  jobRole?: { id: string; name: string };
}

export interface ShiftAssignment {
  id: string;
  shiftId: string;
  employeeId: string;
  assignedAt: string;
  assignedBy: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface GetShiftsParams {
  propertyId: string;
  schedulePeriodId: string;
  start?: string; // ISO datetime
  end?: string; // ISO datetime
  departmentId?: string;
  jobRoleId?: string;
}

export interface CreateShiftPayload {
  schedulePeriodId: string;
  propertyId: string;
  departmentId: string;
  jobRoleId: string;
  startDateTime: string; // ISO datetime
  endDateTime: string; // ISO datetime
  breakMinutes?: number;
  isOpenShift?: boolean;
  notes?: string;
}

export interface UpdateShiftPayload {
  propertyId: string;
  departmentId?: string;
  jobRoleId?: string;
  startDateTime?: string; // ISO datetime
  endDateTime?: string; // ISO datetime
  breakMinutes?: number;
  isOpenShift?: boolean;
  notes?: string;
}

export interface DeleteShiftParams {
  propertyId: string;
}

export interface AssignShiftPayload {
  propertyId: string;
  employeeId: string;
}

export interface UnassignShiftPayload {
  propertyId: string;
  employeeId: string;
}

// ========== API Functions ==========

/**
 * Get shifts for a schedule period
 */
export async function getShifts(params: GetShiftsParams): Promise<Shift[]> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({
    propertyId: params.propertyId,
    ...(params.start && { start: params.start }),
    ...(params.end && { end: params.end }),
    ...(params.departmentId && { departmentId: params.departmentId }),
    ...(params.jobRoleId && { jobRoleId: params.jobRoleId }),
  });

  const response = await client.get<{ success: boolean; data: Shift[] }>(
    `/api/scheduling/v2/schedule-periods/${params.schedulePeriodId}/shifts?${queryParams.toString()}`
  );

  return response.data;
}

/**
 * Create a new shift
 */
export async function createShift(payload: CreateShiftPayload): Promise<Shift> {
  const client = getApiClient();
  const response = await client.post<{ success: boolean; data: Shift }>(
    '/api/scheduling/v2/shifts',
    payload
  );
  return response.data;
}

/**
 * Update an existing shift
 */
export async function updateShift(shiftId: string, payload: UpdateShiftPayload): Promise<Shift> {
  const client = getApiClient();
  const response = await client.patch<{ success: boolean; data: Shift }>(
    `/api/scheduling/v2/shifts/${shiftId}`,
    payload
  );
  return response.data;
}

/**
 * Delete a shift
 */
export async function deleteShift(shiftId: string, params: DeleteShiftParams): Promise<void> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({
    propertyId: params.propertyId,
  });
  await client.delete(`/api/scheduling/v2/shifts/${shiftId}?${queryParams.toString()}`);
}

/**
 * Assign an employee to a shift
 */
export async function assignShift(shiftId: string, payload: AssignShiftPayload): Promise<Shift> {
  const client = getApiClient();
  const response = await client.post<{ success: boolean; data: Shift }>(
    `/api/scheduling/v2/shifts/${shiftId}/assign`,
    payload
  );
  return response.data;
}

/**
 * Unassign an employee from a shift
 */
export async function unassignShift(
  shiftId: string,
  payload: UnassignShiftPayload
): Promise<Shift> {
  const client = getApiClient();
  const response = await client.post<{ success: boolean; data: Shift }>(
    `/api/scheduling/v2/shifts/${shiftId}/unassign`,
    payload
  );
  return response.data;
}

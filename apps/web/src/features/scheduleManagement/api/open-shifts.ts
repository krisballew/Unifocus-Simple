/**
 * Open Shifts API Module
 * Typed functions for accessing open shift marketplace
 */

import { getApiClient } from '../../../services/api-client';

// ========== Types ==========

export interface OpenShift {
  id: string;
  tenantId: string;
  propertyId: string;
  schedulePeriodId: string;
  departmentId: string;
  jobRoleId: string;
  startDateTime: string;
  endDateTime: string;
  breakMinutes: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  department?: { id: string; name: string };
  jobRole?: { id: string; name: string };
}

export interface ListOpenShiftsParams {
  propertyId: string;
  start: string; // ISO date string
  end: string; // ISO date string
  departmentId?: string;
  jobRoleId?: string;
  includeIneligible?: boolean;
}

// ========== API Functions ==========

/**
 * List open shifts for a property within a date range
 */
export async function listOpenShifts(params: ListOpenShiftsParams): Promise<OpenShift[]> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({
    propertyId: params.propertyId,
    start: params.start,
    end: params.end,
    ...(params.departmentId && { departmentId: params.departmentId }),
    ...(params.jobRoleId && { jobRoleId: params.jobRoleId }),
    ...(params.includeIneligible && { includeIneligible: String(params.includeIneligible) }),
  });

  const response = await client.get<{ success: boolean; data: OpenShift[] }>(
    `/api/scheduling/v2/open-shifts?${queryParams.toString()}`
  );
  return response.data;
}

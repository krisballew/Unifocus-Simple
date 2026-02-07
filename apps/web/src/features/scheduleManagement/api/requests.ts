/**
 * Scheduling Requests API Module
 * Typed functions for shift swap, handoff, and open shift claim requests
 */

import { getApiClient } from '../../../services/api-client';

// ========== Types ==========

export type RequestStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface SchedulingRequest {
  id: string;
  tenantId: string;
  propertyId: string;
  requesterId: string;
  toEmployeeId: string | null;
  shiftId: string;
  status: RequestStatus;
  reason?: string | null;
  denialReason?: string | null;
  createdAt: string;
  updatedAt: string;
  // Nested relations
  shift?: {
    id: string;
    startDateTime: string;
    endDateTime: string;
    isOpenShift: boolean;
    departmentId: string;
    jobRoleId: string;
    department?: { id: string; name: string };
    jobRole?: { id: string; name: string };
  };
  requester?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber?: string;
    email: string;
  };
  toEmployee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber?: string;
    email: string;
  };
}

export interface GetRequestsParams {
  propertyId: string;
  status?: RequestStatus;
}

export interface ApproveRequestPayload {
  propertyId: string;
}

export interface DenyRequestPayload {
  propertyId: string;
  reason?: string;
}

// ========== API Functions ==========

/**
 * Get scheduling requests (shift swaps, handoffs, open shift claims)
 */
export async function getRequests(params: GetRequestsParams): Promise<SchedulingRequest[]> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({
    propertyId: params.propertyId,
    ...(params.status && { status: params.status }),
  });

  const response = await client.get<{ success: boolean; data: SchedulingRequest[] }>(
    `/api/scheduling/v2/requests?${queryParams.toString()}`
  );
  return response.data;
}

/**
 * Approve a scheduling request
 */
export async function approveRequest(
  requestId: string,
  payload: ApproveRequestPayload
): Promise<SchedulingRequest> {
  const client = getApiClient();
  const response = await client.post<{ success: boolean; data: SchedulingRequest }>(
    `/api/scheduling/v2/requests/${requestId}/approve`,
    payload
  );
  return response.data;
}

/**
 * Deny a scheduling request
 */
export async function denyRequest(
  requestId: string,
  payload: DenyRequestPayload
): Promise<SchedulingRequest> {
  const client = getApiClient();
  const response = await client.post<{ success: boolean; data: SchedulingRequest }>(
    `/api/scheduling/v2/requests/${requestId}/deny`,
    payload
  );
  return response.data;
}

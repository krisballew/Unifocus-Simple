/**
 * Availability API Module
 * Typed functions for managing employee availability entries
 */

import { getApiClient } from '../../../services/api-client';

// ========== Types ==========

export type AvailabilityType = 'AVAILABLE' | 'UNAVAILABLE' | 'PREFERRED';

export interface AvailabilityEntry {
  id: string;
  tenantId: string;
  propertyId: string;
  employeeId: string;
  date: string; // ISO date (YYYY-MM-DD)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: AvailabilityType;
  recurrenceRule?: string | null; // Optional recurrence pattern
  createdAt: string;
  updatedAt: string;
}

// ========== Parameters ==========

export interface GetAvailabilityParams {
  propertyId: string;
  employeeId: string;
  start?: string; // ISO date
  end?: string; // ISO date
}

export interface CreateAvailabilityPayload {
  propertyId: string;
  employeeId: string;
  date: string; // ISO date (YYYY-MM-DD)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: AvailabilityType;
  recurrenceRule?: string;
}

export interface DeleteAvailabilityParams {
  id: string;
  propertyId: string;
}

// ========== API Functions ==========

/**
 * Get availability entries for an employee within a date range
 */
export async function getAvailability(params: GetAvailabilityParams): Promise<AvailabilityEntry[]> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({
    propertyId: params.propertyId,
    employeeId: params.employeeId,
    ...(params.start && { start: params.start }),
    ...(params.end && { end: params.end }),
  });

  const response = await client.get<{ success: boolean; data: AvailabilityEntry[] }>(
    `/api/scheduling/v2/availability?${queryParams.toString()}`
  );

  return response.data || [];
}

/**
 * Create a new availability entry
 */
export async function createAvailability(
  payload: CreateAvailabilityPayload
): Promise<AvailabilityEntry> {
  const client = getApiClient();
  const response = await client.post<{ success: boolean; data: AvailabilityEntry }>(
    '/api/scheduling/v2/availability',
    payload
  );

  return response.data;
}

/**
 * Delete an availability entry
 */
export async function deleteAvailability(params: DeleteAvailabilityParams): Promise<void> {
  const client = getApiClient();
  await client.delete(
    `/api/scheduling/v2/availability/${params.id}?propertyId=${params.propertyId}`
  );
}

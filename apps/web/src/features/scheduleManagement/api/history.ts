/**
 * Schedule History API module
 * Fetches schedule period lifecycle events (publish/lock)
 */

import { getApiClient } from '../../../services/api-client';

/**
 * Schedule event type
 */
export interface ScheduleEvent {
  id: string;
  type: 'PUBLISHED' | 'LOCKED';
  at: string; // ISO datetime
  byUserId: string;
  byDisplayName?: string;
}

/**
 * Fetch schedule period events for audit trail
 */
export async function getSchedulePeriodEvents(
  schedulePeriodId: string,
  propertyId: string
): Promise<ScheduleEvent[]> {
  const client = getApiClient();
  const response = await client.get<{ success: boolean; data: ScheduleEvent[] }>(
    `/api/scheduling/v2/schedule-periods/${schedulePeriodId}/events?propertyId=${propertyId}`
  );

  if (!response.success) {
    throw new Error(response.message || 'Failed to fetch schedule events');
  }

  return response.data || [];
}

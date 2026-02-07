/**
 * Schedule History API module
 * Fetches schedule period lifecycle events (publish/lock)
 */

import { apiClient } from '../../../services/api-client';

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
  const response = await apiClient.get(
    `/scheduling/v2/schedule-periods/${schedulePeriodId}/events`,
    {
      params: {
        propertyId,
      },
    }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to fetch schedule events');
  }

  return response.data.data || [];
}

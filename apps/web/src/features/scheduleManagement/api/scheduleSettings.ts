/**
 * Schedule Settings API Module
 * Typed functions for schedule settings templates
 */

import { getApiClient } from '../../../services/api-client';

export type PlanningPeriodType = 'WEEKLY' | 'BIWEEKLY' | 'SEMIMONTHLY' | 'MONTHLY';

export interface ScheduleTemplate {
  id: string;
  name: string;
  type: PlanningPeriodType;
  weekly?: { startDow: number; endDow: number };
  monthly?: { startDom: number };
  semiMonthly?: { startDom: number };
}

export interface ScheduleSettingsResponse {
  propertyId: string;
  templates: ScheduleTemplate[];
}

export interface GetScheduleSettingsParams {
  propertyId: string;
}

export interface UpdateScheduleSettingsParams {
  propertyId: string;
  templates: ScheduleTemplate[];
}

export async function getScheduleSettings(
  params: GetScheduleSettingsParams
): Promise<ScheduleSettingsResponse> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({ propertyId: params.propertyId });
  const response = await client.get<{ success: boolean; data: ScheduleSettingsResponse }>(
    `/api/scheduling/v2/settings/schedule?${queryParams.toString()}`
  );
  return response.data;
}

export async function updateScheduleSettings(
  params: UpdateScheduleSettingsParams
): Promise<ScheduleSettingsResponse> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({ propertyId: params.propertyId });
  const response = await client.put<{ success: boolean; data: ScheduleSettingsResponse }>(
    `/api/scheduling/v2/settings/schedule?${queryParams.toString()}`,
    { templates: params.templates }
  );
  return response.data;
}

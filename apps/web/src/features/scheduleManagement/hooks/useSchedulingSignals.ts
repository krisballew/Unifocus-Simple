/**
 * Hook to fetch scheduling signals for dashboard display
 * Provides counts for pending requests, open shifts, unassigned shifts, and current period status
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { SchedulePeriod } from '../../../services/api-client';
import { getSchedulePeriods } from '../../../services/api-client';
import { listOpenShifts } from '../api/open-shifts';
import { getRequests } from '../api/requests';
import { getShifts } from '../api/shifts';

import { queryKeys } from './useSchedulingSignals.keys';

// Calculate date range for "next 7 days" in local timezone
function getNext7DaysRange(): { start: string; end: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 6); // +6 to get 7 days total (today through day+6)
  endDate.setHours(23, 59, 59, 999);

  const start = today.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  return { start, end };
}

// Find current schedule period
function findCurrentPeriod(periods: SchedulePeriod[]): SchedulePeriod | undefined {
  if (!periods.length) return undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().split('T')[0];

  // First, try to find a period where today is within the date range
  const currentPeriod = periods.find((p) => {
    return p.startDate <= todayIso && p.endDate >= todayIso;
  });

  if (currentPeriod) {
    // Among matching periods, prefer DRAFT over others
    const draftPeriod = periods.find(
      (p) => p.startDate <= todayIso && p.endDate >= todayIso && p.status === 'DRAFT'
    );
    return draftPeriod || currentPeriod;
  }

  // If no period contains today, return the latest by startDate
  return periods.reduce((latest, period) => {
    return period.startDate > latest.startDate ? period : latest;
  });
}

export interface SchedulingSignalsData {
  pendingRequestsCount: number;
  openShiftsCount: number;
  unassignedShiftsCount: number;
  currentPeriodStatus: 'DRAFT' | 'PUBLISHED' | 'LOCKED' | null;
  currentPeriodId: string | null;
  currentPeriodDateRange: string | null;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export interface UseSchedulingSignalsParams {
  propertyId: string | null | undefined;
  enabled: boolean;
}

export function useSchedulingSignals({
  propertyId,
  enabled,
}: UseSchedulingSignalsParams): SchedulingSignalsData {
  const { start: rangeStart, end: rangeEnd } = getNext7DaysRange();

  // Fetch pending requests
  const requestsQuery = useQuery({
    queryKey: queryKeys.pendingRequests(propertyId),
    queryFn: () =>
      getRequests({
        propertyId: propertyId!,
        status: 'PENDING',
      }),
    enabled: enabled && Boolean(propertyId),
    staleTime: 60 * 1000, // 60 seconds
  });

  // Fetch open shifts for next 7 days
  const openShiftsQuery = useQuery({
    queryKey: queryKeys.openShifts(propertyId, rangeStart, rangeEnd),
    queryFn: () =>
      listOpenShifts({
        propertyId: propertyId!,
        start: rangeStart,
        end: rangeEnd,
        includeIneligible: true,
      }),
    enabled: enabled && Boolean(propertyId),
    staleTime: 60 * 1000,
  });

  // Fetch schedule periods
  const periodsQuery = useQuery({
    queryKey: queryKeys.schedulePeriods(propertyId),
    queryFn: () =>
      getSchedulePeriods({
        propertyId: propertyId!,
      }),
    enabled: enabled && Boolean(propertyId),
    staleTime: 60 * 1000,
  });

  // Fetch shifts for current period to count unassigned
  const currentPeriod = useMemo(
    () => findCurrentPeriod(periodsQuery.data || []),
    [periodsQuery.data]
  );

  const shiftsQuery = useQuery({
    queryKey: queryKeys.unassignedShifts(propertyId, currentPeriod?.id, rangeStart, rangeEnd),
    queryFn: () =>
      getShifts({
        propertyId: propertyId!,
        schedulePeriodId: currentPeriod!.id,
        start: rangeStart,
        end: rangeEnd,
      }),
    enabled: enabled && Boolean(propertyId) && Boolean(currentPeriod),
    staleTime: 60 * 1000,
  });

  // Compute counts
  const pendingRequestsCount = requestsQuery.data?.length ?? 0;
  const openShiftsCount = openShiftsQuery.data?.length ?? 0;

  // Unassigned shifts: not open shifts AND no employee assignments
  const unassignedShiftsCount = useMemo(() => {
    const shifts = shiftsQuery.data || [];
    return shifts.filter(
      (shift) => !shift.isOpenShift && (!shift.assignments || shift.assignments.length === 0)
    ).length;
  }, [shiftsQuery.data]);

  const currentPeriodStatus = currentPeriod?.status ?? null;
  const currentPeriodId = currentPeriod?.id ?? null;

  const currentPeriodDateRange = useMemo(() => {
    if (!currentPeriod) return null;
    return `${currentPeriod.startDate} – ${currentPeriod.endDate}`;
  }, [currentPeriod]);

  // Determine loading and error states
  const isLoading =
    requestsQuery.isLoading ||
    openShiftsQuery.isLoading ||
    periodsQuery.isLoading ||
    shiftsQuery.isLoading;

  const hasError =
    requestsQuery.isError || openShiftsQuery.isError || periodsQuery.isError || shiftsQuery.isError;

  const errorMessage = useMemo(() => {
    if (requestsQuery.isError) return 'Failed to load pending requests';
    if (openShiftsQuery.isError) return 'Failed to load open shifts';
    if (periodsQuery.isError) return 'Failed to load schedule periods';
    if (shiftsQuery.isError) return 'Failed to load shifts';
    return undefined;
  }, [requestsQuery.isError, openShiftsQuery.isError, periodsQuery.isError, shiftsQuery.isError]);

  return {
    pendingRequestsCount,
    openShiftsCount,
    unassignedShiftsCount,
    currentPeriodStatus,
    currentPeriodId,
    currentPeriodDateRange,
    isLoading,
    hasError,
    errorMessage,
  };
}

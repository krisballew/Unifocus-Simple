/**
 * Query keys for scheduling signals queries
 */

export const queryKeys = {
  pendingRequests: (propertyId: string | null | undefined) =>
    ['schedSignals', propertyId ?? 'all', 'pendingRequests'] as const,

  openShifts: (propertyId: string | null | undefined, start: string, end: string) =>
    ['schedSignals', propertyId ?? 'all', 'openShifts', start, end] as const,

  schedulePeriods: (propertyId: string | null | undefined) =>
    ['schedSignals', propertyId ?? 'all', 'periods'] as const,

  unassignedShifts: (
    propertyId: string | null | undefined,
    periodId: string | null | undefined,
    start: string,
    end: string
  ) => ['schedSignals', propertyId ?? 'all', 'unassigned', periodId ?? 'all', start, end] as const,
};

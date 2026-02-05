export const queryKeys = {
  currentUser: ['currentUser'] as const,
  tenants: (userId: string | undefined) => ['tenants', userId ?? 'me'] as const,
  tenant: (tenantId: string | undefined) => ['tenant', tenantId ?? 'unknown'] as const,
  properties: (tenantId: string | undefined) => ['properties', tenantId ?? 'unknown'] as const,
  property: (tenantId: string | undefined, propertyId: string | undefined) =>
    ['property', tenantId ?? 'unknown', propertyId ?? 'unknown'] as const,
  employees: (propertyId?: string) => ['employees', propertyId ?? 'all'] as const,
  schedules: () => ['schedules'] as const,
  punches: (employeeId: string | undefined, startDate?: string, endDate?: string) =>
    ['punches', employeeId ?? 'all', startDate, endDate] as const,
  exceptions: (status?: string) => ['exceptions', status ?? 'all'] as const,
  exception: (exceptionId: string | undefined) => ['exception', exceptionId ?? 'unknown'] as const,
};

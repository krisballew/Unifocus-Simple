export const queryKeys = {
  currentUser: ['currentUser'] as const,
  tenants: (userId: string | undefined) => ['tenants', userId ?? 'me'] as const,
  tenant: (tenantId: string | undefined) => ['tenant', tenantId ?? 'unknown'] as const,
  properties: (tenantId: string | undefined) => ['properties', tenantId ?? 'unknown'] as const,
  property: (tenantId: string | undefined, propertyId: string | undefined) =>
    ['property', tenantId ?? 'unknown', propertyId ?? 'unknown'] as const,
};

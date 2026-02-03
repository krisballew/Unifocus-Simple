import { useQuery } from '@tanstack/react-query';
import React, { useEffect } from 'react';

import { useSelection } from '../context/SelectionContext';
import { getTenantProperties, getTenants, type Tenant } from '../services/api-client';
import { queryKeys } from '../services/query-keys';

import { LoadingSkeleton } from './LoadingSkeleton';

export interface PropertySelectorProps {
  userId?: string;
}

export function PropertySelector({ userId }: PropertySelectorProps): React.ReactElement {
  const { selectedTenantId, selectedPropertyId, setSelectedTenantId, setSelectedPropertyId } =
    useSelection();

  const tenantsQuery = useQuery({
    queryKey: queryKeys.tenants(userId),
    queryFn: getTenants,
    staleTime: 60_000,
  });

  const tenantId = selectedTenantId ?? tenantsQuery.data?.[0]?.id ?? null;

  const propertiesQuery = useQuery({
    queryKey: queryKeys.properties(tenantId ?? undefined),
    queryFn: () => (tenantId ? getTenantProperties(tenantId) : Promise.resolve([])),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!selectedTenantId && tenantId) {
      setSelectedTenantId(tenantId);
    }
  }, [selectedTenantId, setSelectedTenantId, tenantId]);

  useEffect(() => {
    if (!propertiesQuery.data) return;
    if (propertiesQuery.data.length === 0) {
      setSelectedPropertyId(null);
      return;
    }

    const propertyExists = propertiesQuery.data.some(
      (property) => property.id === selectedPropertyId
    );
    if (!propertyExists) {
      setSelectedPropertyId(propertiesQuery.data[0]?.id ?? null);
    }
  }, [propertiesQuery.data, selectedPropertyId, setSelectedPropertyId]);

  if (tenantsQuery.isLoading) {
    return <LoadingSkeleton lines={2} />;
  }

  if (tenantsQuery.error) {
    return <div className="selector-error">Unable to load tenants.</div>;
  }

  const tenants = tenantsQuery.data ?? [];

  return (
    <div className="property-selector">
      <div className="selector-group">
        <label htmlFor="tenant-select">Tenant</label>
        <select
          id="tenant-select"
          value={tenantId ?? ''}
          onChange={(event) => {
            setSelectedTenantId(event.target.value || null);
            setSelectedPropertyId(null);
          }}
        >
          {tenants.map((tenant: Tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </div>

      <div className="selector-group">
        <label htmlFor="property-select">Property</label>
        {propertiesQuery.isLoading ? (
          <LoadingSkeleton lines={1} />
        ) : (
          <select
            id="property-select"
            value={selectedPropertyId ?? ''}
            onChange={(event) => setSelectedPropertyId(event.target.value || null)}
          >
            {(propertiesQuery.data ?? []).map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import React, { useEffect } from 'react';

import { useSelection } from '../context/SelectionContext';
import { getTenantProperties, getTenants, type Tenant } from '../services/api-client';
import { queryKeys } from '../services/query-keys';

import { LoadingSkeleton } from './LoadingSkeleton';

export interface PropertySelectorProps {
  userId?: string;
  onPropertySelect?: (propertyId: string | null) => void;
}

export function PropertySelector({
  userId,
  onPropertySelect,
}: PropertySelectorProps): React.ReactElement {
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
      onPropertySelect?.(null);
      return;
    }

    // Only auto-select first property if no property is currently selected
    // This allows external sources (like user preferences) to set the property
    if (selectedPropertyId === null) {
      const newId = propertiesQuery.data[0]?.id ?? null;
      setSelectedPropertyId(newId);
      onPropertySelect?.(newId);
    } else {
      // If a property is selected, verify it exists in the list
      const propertyExists = propertiesQuery.data.some(
        (property) => property.id === selectedPropertyId
      );
      // If it doesn't exist, reset to first property
      if (!propertyExists) {
        const newId = propertiesQuery.data[0]?.id ?? null;
        setSelectedPropertyId(newId);
        onPropertySelect?.(newId);
      }
    }
  }, [propertiesQuery.data, selectedPropertyId, setSelectedPropertyId, onPropertySelect]);

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
        <label htmlFor="tenant-select">Company</label>
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
            onChange={(event) => {
              const newId = event.target.value || null;
              setSelectedPropertyId(newId);
              onPropertySelect?.(newId);
            }}
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

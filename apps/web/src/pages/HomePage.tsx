import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useSelection } from '../context/SelectionContext';
import {
  getCurrentUser,
  getProperty,
  getTenant,
  getTenantProperties,
} from '../services/api-client';
import { queryKeys } from '../services/query-keys';

export function HomePage(): React.ReactElement {
  const { selectedTenantId, selectedPropertyId } = useSelection();

  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
  });

  const tenantQuery = useQuery({
    queryKey: queryKeys.tenant(selectedTenantId ?? undefined),
    queryFn: () => (selectedTenantId ? getTenant(selectedTenantId) : Promise.resolve(null)),
    enabled: Boolean(selectedTenantId),
  });

  const propertiesQuery = useQuery({
    queryKey: queryKeys.properties(selectedTenantId ?? undefined),
    queryFn: () => (selectedTenantId ? getTenantProperties(selectedTenantId) : Promise.resolve([])),
    enabled: Boolean(selectedTenantId),
  });

  const propertyQuery = useQuery({
    queryKey: queryKeys.property(selectedTenantId ?? undefined, selectedPropertyId ?? undefined),
    queryFn: () =>
      selectedPropertyId && selectedTenantId
        ? getProperty(selectedPropertyId)
        : Promise.resolve(null),
    enabled: Boolean(selectedTenantId && selectedPropertyId),
  });

  if (currentUserQuery.isLoading) {
    return <LoadingSkeleton lines={6} card />;
  }

  const user = currentUserQuery.data;
  const tenant = tenantQuery.data;
  const property = propertyQuery.data;
  const properties = propertiesQuery.data ?? [];

  return (
    <div className="home">
      <section className="home-hero">
        <div>
          <h2>Welcome back{user?.email ? `, ${user.email}` : ''}</h2>
          <p>Here is a quick snapshot of your current workspace.</p>
        </div>
        <div className="home-card">
          <p className="home-card__label">Active Tenant</p>
          <h3>{tenant?.name ?? 'Select a tenant'}</h3>
          <p>{tenant?.id ?? ''}</p>
        </div>
      </section>

      <section className="home-grid">
        <div className="home-card">
          <p className="home-card__label">Selected Property</p>
          <h3>{property?.name ?? 'Select a property'}</h3>
          <p>{property?.address ?? 'No address on file'}</p>
        </div>
        <div className="home-card">
          <p className="home-card__label">Properties in Tenant</p>
          <h3>{properties.length}</h3>
          <p>Loaded from /api/tenants/:id/properties</p>
        </div>
        <div className="home-card">
          <p className="home-card__label">Roles</p>
          <div className="role-list">
            {(user?.roles ?? []).map((role) => (
              <span className="role-pill" key={role}>
                {role}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

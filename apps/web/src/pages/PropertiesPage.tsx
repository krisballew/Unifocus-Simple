import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useSelection } from '../context/SelectionContext';
import { getTenantProperties } from '../services/api-client';
import { queryKeys } from '../services/query-keys';

export function PropertiesPage(): React.ReactElement {
  const { selectedTenantId } = useSelection();

  const propertiesQuery = useQuery({
    queryKey: queryKeys.properties(selectedTenantId ?? undefined),
    queryFn: () => (selectedTenantId ? getTenantProperties(selectedTenantId) : Promise.resolve([])),
    enabled: Boolean(selectedTenantId),
  });

  if (propertiesQuery.isLoading) {
    return <LoadingSkeleton lines={8} card />;
  }

  if (propertiesQuery.isError) {
    return (
      <div className="placeholder">
        <h2>Properties</h2>
        <p>Failed to load properties.</p>
      </div>
    );
  }

  const properties = propertiesQuery.data ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <h2>Properties</h2>
        <p>Showing {properties.length} properties in the selected tenant.</p>
      </div>

      <div className="page-grid">
        {properties.map((property) => (
          <div className="page-card" key={property.id}>
            <h3>{property.name}</h3>
            <p>{property.address ?? 'No address on file'}</p>
            <p>
              {[property.city, property.state, property.zipCode].filter(Boolean).join(', ') ||
                'No location details'}
            </p>
            <p className="muted">Property ID: {property.id}</p>
          </div>
        ))}
        {properties.length === 0 && (
          <div className="page-card">
            <h3>No properties found</h3>
            <p>Try selecting a different tenant.</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import { LoadingSkeleton } from '../../../components/LoadingSkeleton';
import { useSelection } from '../../../context/SelectionContext';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission, SCHEDULING_PERMISSIONS } from '../../../utils/permissions';
import { getRequests } from '../api/requests';
import type { RequestStatus } from '../api/requests';
import { RequestsTable } from '../components/RequestsTable';

export function RequestsPage(): React.ReactElement {
  const { selectedTenantId, selectedPropertyId } = useSelection();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Permission checks
  const canManageRequests = hasPermission(user, SCHEDULING_PERMISSIONS.MANAGE_REQUESTS);

  // State
  const [statusFilter, setStatusFilter] = useState<RequestStatus>('PENDING');

  // Fetch requests
  const requestsQuery = useQuery({
    queryKey: ['requests', selectedPropertyId ?? 'all', statusFilter],
    queryFn: () =>
      getRequests({
        propertyId: selectedPropertyId!,
        status: statusFilter,
      }),
    enabled: Boolean(selectedTenantId && selectedPropertyId && canManageRequests),
  });

  if (!selectedPropertyId) {
    return (
      <div className="page-container">
        <h1>Scheduling Requests</h1>
        <div className="panel">
          <p>Please select a property to view scheduling requests.</p>
        </div>
      </div>
    );
  }

  if (!canManageRequests) {
    return (
      <div className="page-container">
        <h1>Scheduling Requests</h1>
        <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#d32f2f' }}>You don't have access to Requests management.</p>
          <small style={{ color: '#666' }}>
            Contact your administrator if you need this permission.
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1>Scheduling Requests</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label htmlFor="status-filter" style={{ marginBottom: 0 }}>
            Status:
          </label>
          <select
            id="status-filter"
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RequestStatus)}
            style={{ minWidth: '150px' }}
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
          </select>
        </div>
      </div>

      {requestsQuery.isLoading ? (
        <LoadingSkeleton />
      ) : requestsQuery.isError ? (
        <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#d32f2f' }}>Error loading requests. Please try again.</p>
        </div>
      ) : !requestsQuery.data || requestsQuery.data.length === 0 ? (
        <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#666' }}>No {statusFilter.toLowerCase()} requests found.</p>
        </div>
      ) : (
        <RequestsTable
          requests={requestsQuery.data}
          propertyId={selectedPropertyId}
          onRequestUpdated={() => queryClient.invalidateQueries({ queryKey: ['requests'] })}
        />
      )}
    </div>
  );
}

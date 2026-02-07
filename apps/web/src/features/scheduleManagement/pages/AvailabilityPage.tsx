import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import { LoadingSkeleton } from '../../../components/LoadingSkeleton';
import { useSelection } from '../../../context/SelectionContext';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission, SCHEDULING_PERMISSIONS } from '../../../utils/permissions';
import { createAvailability, getAvailability } from '../api/availability';
import type { AvailabilityType } from '../api/availability';
import { AvailabilityFilters } from '../components/AvailabilityFilters';
import { AvailabilityModal } from '../components/AvailabilityModal';
import { AvailabilityTable } from '../components/AvailabilityTable';
import { formatApiError } from '../utils/apiErrors';

export function AvailabilityPage(): React.ReactElement {
  const { selectedTenantId, selectedPropertyId } = useSelection();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Permission checks
  const canView = hasPermission(user, SCHEDULING_PERMISSIONS.VIEW);
  const canManage = hasPermission(user, SCHEDULING_PERMISSIONS.MANAGE_AVAILABILITY);

  // State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    // Start from Monday of current week
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + 1);
    // End on Sunday of current week
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  const [showModal, setShowModal] = useState(false);

  // Fetch availability entries
  const availabilityQuery = useQuery({
    queryKey: [
      'availability',
      selectedPropertyId,
      selectedEmployeeId,
      dateRange.start,
      dateRange.end,
    ],
    queryFn: () =>
      getAvailability({
        propertyId: selectedPropertyId!,
        employeeId: selectedEmployeeId!,
        start: dateRange.start,
        end: dateRange.end,
      }),
    enabled: Boolean(selectedTenantId && selectedPropertyId && selectedEmployeeId && canView),
  });

  // Create availability mutation
  const createMutation = useMutation({
    mutationFn: (data: {
      date: string;
      startTime: string;
      endTime: string;
      type: AvailabilityType;
      recurrenceRule?: string;
    }) =>
      createAvailability({
        propertyId: selectedPropertyId!,
        employeeId: selectedEmployeeId!,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        type: data.type,
        recurrenceRule: data.recurrenceRule,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'availability',
          selectedPropertyId,
          selectedEmployeeId,
          dateRange.start,
          dateRange.end,
        ],
      });
    },
    onError: (error) => {
      alert(`Failed to create availability: ${formatApiError(error)}`);
    },
  });

  if (!selectedPropertyId) {
    return (
      <div className="page-container">
        <h1>Employee Availability</h1>
        <div className="panel">
          <p>Please select a property to manage employee availability.</p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="page-container">
        <h1>Employee Availability</h1>
        <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#d32f2f' }}>You don't have access to Availability management.</p>
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
        <h1>Employee Availability</h1>
        {canManage && selectedEmployeeId && (
          <button
            type="button"
            className="button button--primary"
            onClick={() => setShowModal(true)}
            disabled={createMutation.isPending}
          >
            + Add Availability
          </button>
        )}
      </div>

      <AvailabilityFilters
        propertyId={selectedPropertyId}
        selectedEmployeeId={selectedEmployeeId}
        onEmployeeChange={setSelectedEmployeeId}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {!selectedEmployeeId ? (
        <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#666' }}>Select an employee to view their availability.</p>
        </div>
      ) : availabilityQuery.isLoading ? (
        <LoadingSkeleton />
      ) : availabilityQuery.isError ? (
        <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#d32f2f' }}>Error loading availability. Please try again.</p>
        </div>
      ) : (
        <AvailabilityTable
          entries={availabilityQuery.data ?? []}
          propertyId={selectedPropertyId}
          isLoading={createMutation.isPending}
          canDelete={canManage}
          onDelete={() =>
            queryClient.invalidateQueries({
              queryKey: [
                'availability',
                selectedPropertyId,
                selectedEmployeeId,
                dateRange.start,
                dateRange.end,
              ],
            })
          }
        />
      )}

      {showModal && selectedEmployeeId && (
        <AvailabilityModal
          onClose={() => setShowModal(false)}
          onSubmit={async (data) => {
            await createMutation.mutateAsync(data);
            setShowModal(false);
          }}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  );
}

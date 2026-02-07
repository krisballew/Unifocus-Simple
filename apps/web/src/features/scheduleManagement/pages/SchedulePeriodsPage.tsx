import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import { LoadingSkeleton } from '../../../components/LoadingSkeleton';
import { useSelection } from '../../../context/SelectionContext';
import { useAuth } from '../../../hooks/useAuth';
import {
  createSchedulePeriod,
  getSchedulePeriods,
  lockSchedulePeriod,
  publishSchedulePeriod,
} from '../../../services/api-client';
import { hasPermission, SCHEDULING_PERMISSIONS } from '../../../utils/permissions';
import { CreateSchedulePeriodModal } from '../components/CreateSchedulePeriodModal';
import { SchedulePeriodList } from '../components/SchedulePeriodList';

export function SchedulePeriodsPage(): React.ReactElement {
  const { selectedTenantId, selectedPropertyId } = useSelection();
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  // Permission checks
  const canCreatePeriod = hasPermission(user, SCHEDULING_PERMISSIONS.EDIT_SHIFTS);
  const canPublish = hasPermission(user, SCHEDULING_PERMISSIONS.PUBLISH);
  const canLock = hasPermission(user, SCHEDULING_PERMISSIONS.LOCK);

  const periodsQuery = useQuery({
    queryKey: ['schedulePeriods', selectedPropertyId ?? 'all'],
    queryFn: () =>
      getSchedulePeriods({
        propertyId: selectedPropertyId!,
      }),
    enabled: Boolean(selectedTenantId && selectedPropertyId),
  });

  const createMutation = useMutation({
    mutationFn: createSchedulePeriod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulePeriods'] });
      setShowCreateModal(false);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishSchedulePeriod({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulePeriods'] });
    },
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => lockSchedulePeriod({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulePeriods'] });
    },
  });

  const isLoading = createMutation.isPending || publishMutation.isPending || lockMutation.isPending;

  if (!selectedPropertyId) {
    return (
      <div className="placeholder">
        <h2>Schedule Periods</h2>
        <p>Please select a property to view schedule periods.</p>
      </div>
    );
  }

  if (periodsQuery.isLoading) {
    return <LoadingSkeleton lines={10} card />;
  }

  if (periodsQuery.isError) {
    return (
      <div className="placeholder">
        <h2>Schedule Periods</h2>
        <p>Failed to load schedule periods.</p>
      </div>
    );
  }

  const periods = periodsQuery.data ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Schedule Periods</h2>
          <p>Manage scheduling periods for your property.</p>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setShowCreateModal(true)}
          disabled={isLoading || !canCreatePeriod}
          title={!canCreatePeriod ? 'You do not have permission to create schedule periods' : ''}
        >
          Create Period
        </button>
      </div>

      <SchedulePeriodList
        periods={periods}
        onPublish={(id) => publishMutation.mutate(id)}
        onLock={(id) => lockMutation.mutate(id)}
        isLoading={isLoading}
        canPublish={canPublish}
        canLock={canLock}
      />

      {showCreateModal && selectedPropertyId && canCreatePeriod && (
        <CreateSchedulePeriodModal
          propertyId={selectedPropertyId}
          onClose={() => setShowCreateModal(false)}
          onCreate={(params) => createMutation.mutate(params)}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  );
}

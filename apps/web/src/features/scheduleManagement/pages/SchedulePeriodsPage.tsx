import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import { LoadingSkeleton } from '../../../components/LoadingSkeleton';
import { useSelection } from '../../../context/SelectionContext';
import { useAuth } from '../../../hooks/useAuth';
import type { SchedulePeriod } from '../../../services/api-client';
import {
  createSchedulePeriod,
  getSchedulePeriods,
  lockSchedulePeriod,
  publishSchedulePeriod,
} from '../../../services/api-client';
import { hasPermission, SCHEDULING_PERMISSIONS } from '../../../utils/permissions';
import { ConfirmLockModal } from '../components/ConfirmLockModal';
import { ConfirmPublishModal } from '../components/ConfirmPublishModal';
import { CreateSchedulePeriodModal } from '../components/CreateSchedulePeriodModal';
import { SchedulePeriodList } from '../components/SchedulePeriodList';
import { formatApiError } from '../utils/apiErrors';

export function SchedulePeriodsPage(): React.ReactElement {
  const { selectedTenantId, selectedPropertyId, isHydrated } = useSelection();
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [publishingPeriod, setPublishingPeriod] = useState<SchedulePeriod | null>(null);
  const [lockingPeriod, setLockingPeriod] = useState<SchedulePeriod | null>(null);
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
    enabled: Boolean(isHydrated && selectedTenantId && selectedPropertyId),
  });

  const createMutation = useMutation({
    mutationFn: createSchedulePeriod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulePeriods'] });
      setShowCreateModal(false);
    },
    onError: (error) => {
      alert(`Failed to create schedule period: ${formatApiError(error)}`);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishSchedulePeriod({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulePeriods'] });
      setPublishingPeriod(null);
    },
    onError: (error) => {
      alert(`Failed to publish schedule: ${formatApiError(error)}`);
    },
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => lockSchedulePeriod({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulePeriods'] });
      setLockingPeriod(null);
    },
    onError: (error) => {
      alert(`Failed to lock schedule period: ${formatApiError(error)}`);
    },
  });

  const isLoading = createMutation.isPending || publishMutation.isPending || lockMutation.isPending;

  if (!isHydrated) {
    return <LoadingSkeleton lines={10} card />;
  }

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
        onPublish={(period) => setPublishingPeriod(period)}
        onLock={(period) => setLockingPeriod(period)}
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

      {publishingPeriod && selectedPropertyId && (
        <ConfirmPublishModal
          period={publishingPeriod}
          propertyId={selectedPropertyId}
          onConfirm={() => publishMutation.mutate(publishingPeriod.id)}
          onCancel={() => setPublishingPeriod(null)}
          isLoading={publishMutation.isPending}
        />
      )}

      {lockingPeriod && selectedPropertyId && (
        <ConfirmLockModal
          period={lockingPeriod}
          propertyId={selectedPropertyId}
          onConfirm={() => lockMutation.mutate(lockingPeriod.id)}
          onCancel={() => setLockingPeriod(null)}
          isLoading={lockMutation.isPending}
        />
      )}
    </div>
  );
}

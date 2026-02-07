import React, { useEffect, useState } from 'react';

import type { SchedulePeriod } from '../../../services/api-client';
import { getRequests, type SchedulingRequest } from '../api/requests';
import { getShifts, type Shift } from '../api/shifts';

export interface ConfirmLockModalProps {
  period: SchedulePeriod;
  propertyId: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface PreflightData {
  pendingRequestsCount: number;
  openShiftsCount: number;
  unassignedShiftsCount: number;
  isLoadingPreflight: boolean;
  error?: string;
}

export function ConfirmLockModal({
  period,
  propertyId,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmLockModalProps): React.ReactElement {
  const [preflight, setPreflight] = useState<PreflightData>({
    pendingRequestsCount: 0,
    openShiftsCount: 0,
    unassignedShiftsCount: 0,
    isLoadingPreflight: true,
  });

  useEffect(() => {
    const fetchPreflightData = async () => {
      try {
        setPreflight((prev) => ({ ...prev, isLoadingPreflight: true, error: undefined }));

        // Fetch pending requests for the property
        const requests = await getRequests({
          propertyId,
          status: 'PENDING',
        });

        // Fetch shifts in the period
        const shifts = await getShifts({
          propertyId,
          schedulePeriodId: period.id,
        });

        // Count open and unassigned shifts
        const openShiftsCount = shifts.filter((s: Shift) => s.isOpenShift).length;
        const unassignedShiftsCount = shifts.filter(
          (s: Shift) => !s.isOpenShift && (!s.assignments || s.assignments.length === 0)
        ).length;

        setPreflight({
          pendingRequestsCount: (requests as SchedulingRequest[]).length,
          openShiftsCount,
          unassignedShiftsCount,
          isLoadingPreflight: false,
        });
      } catch (err) {
        setPreflight((prev) => ({
          ...prev,
          isLoadingPreflight: false,
          error: err instanceof Error ? err.message : 'Failed to load data',
        }));
      }
    };

    fetchPreflightData();
  }, [period.id, propertyId]);

  const hasWarnings =
    preflight.pendingRequestsCount > 0 ||
    preflight.openShiftsCount > 0 ||
    preflight.unassignedShiftsCount > 0;

  const formatDateRange = (): string => {
    const start = new Date(period.startDate).toLocaleDateString();
    const end = new Date(period.endDate).toLocaleDateString();
    return `${start} – ${end}`;
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Lock Schedule?</h2>
          <button type="button" className="modal-close" onClick={onCancel} disabled={isLoading}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: '1.5rem' }}>
            <p>
              Locking prevents further edits to this schedule period. Employees will no longer be
              able to request changes, and managers cannot modify shifts (edit requires override
              permission).
            </p>
            <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
              <strong>Period:</strong> {period.name || 'Unnamed'} ({formatDateRange()})
            </div>
          </div>

          {preflight.isLoadingPreflight && (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <p>Checking schedule status...</p>
            </div>
          )}

          {!preflight.isLoadingPreflight && preflight.error && (
            <div className="alert alert--warning" style={{ marginBottom: '1rem' }}>
              Could not load all warnings: {preflight.error}
            </div>
          )}

          {!preflight.isLoadingPreflight && hasWarnings && (
            <div
              className="preflight-warnings"
              style={{
                backgroundColor: '#fffbf0',
                border: '1px solid #f0ad4e',
                borderRadius: '4px',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                <span style={{ fontSize: '1.25rem', marginTop: '-2px' }}>⚠</span>
                <div>
                  <strong>Schedule warnings:</strong>
                  <ul
                    style={{
                      marginTop: '0.5rem',
                      paddingLeft: '1.5rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    {preflight.openShiftsCount > 0 && (
                      <li>{preflight.openShiftsCount} open shifts remain.</li>
                    )}
                    {preflight.unassignedShiftsCount > 0 && (
                      <li>{preflight.unassignedShiftsCount} unassigned shifts remain.</li>
                    )}
                    {preflight.pendingRequestsCount > 0 && (
                      <li>{preflight.pendingRequestsCount} pending requests awaiting review.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {!preflight.isLoadingPreflight && !hasWarnings && (
            <div
              className="alert alert--success"
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                color: '#166534',
                marginBottom: '1rem',
              }}
            >
              Schedule is complete. All shifts are assigned and no pending requests remain.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={onConfirm}
            disabled={isLoading || preflight.isLoadingPreflight}
          >
            {isLoading ? 'Locking...' : 'Lock'}
          </button>
        </div>
      </div>
    </div>
  );
}

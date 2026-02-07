import React from 'react';

import type { SchedulePeriod } from '../../../services/api-client';

import { ScheduleStatusBadge } from './ScheduleStatusBadge';

export interface SchedulePeriodListProps {
  periods: SchedulePeriod[];
  onPublish: (periodId: string) => void;
  onLock: (periodId: string) => void;
  isLoading?: boolean;
}

export function SchedulePeriodList({
  periods,
  onPublish,
  onLock,
  isLoading = false,
}: SchedulePeriodListProps): React.ReactElement {
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
  };

  const canPublish = (period: SchedulePeriod): boolean => {
    return period.status === 'DRAFT';
  };

  const canLock = (period: SchedulePeriod): boolean => {
    return period.status === 'PUBLISHED';
  };

  return (
    <div className="page-table">
      <div className="page-table__row page-table__header">
        <div>Period</div>
        <div>Dates</div>
        <div>Status</div>
        <div>Published</div>
        <div>Locked</div>
        <div>Actions</div>
      </div>
      {periods.map((period) => (
        <div className="page-table__row" key={period.id}>
          <div>{period.name || 'Unnamed Period'}</div>
          <div>
            {formatDate(period.startDate)} – {formatDate(period.endDate)}
          </div>
          <div>
            <ScheduleStatusBadge status={period.status} />
          </div>
          <div>{formatDateTime(period.publishedAt)}</div>
          <div>{formatDateTime(period.lockedAt)}</div>
          <div>
            {canPublish(period) && (
              <button
                type="button"
                className="button button--small"
                onClick={() => onPublish(period.id)}
                disabled={isLoading}
              >
                Publish
              </button>
            )}
            {canLock(period) && (
              <button
                type="button"
                className="button button--small"
                onClick={() => onLock(period.id)}
                disabled={isLoading}
                style={{ marginLeft: '0.5rem' }}
              >
                Lock
              </button>
            )}
          </div>
        </div>
      ))}
      {periods.length === 0 && (
        <div className="page-table__row">
          <div>No schedule periods found.</div>
        </div>
      )}
    </div>
  );
}

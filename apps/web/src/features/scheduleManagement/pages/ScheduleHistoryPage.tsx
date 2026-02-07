/**
 * Schedule History Page
 * Displays schedule period lifecycle events (publish/lock) audit trail
 */

import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';

import { LoadingSkeleton } from '../../../components/LoadingSkeleton';
import { useSelection } from '../../../context/SelectionContext';
import { useAuth } from '../../../hooks/useAuth';
import { getSchedulePeriods } from '../../../services/api-client';
import { hasPermission, SCHEDULING_PERMISSIONS } from '../../../utils/permissions';
import { getSchedulePeriodEvents } from '../api/history';
import type { ScheduleEvent } from '../api/history';

function formatEventType(type: string): string {
  switch (type) {
    case 'PUBLISHED':
      return 'Published';
    case 'LOCKED':
      return 'Locked';
    default:
      return type;
  }
}

function getEventTypeColor(type: string): string {
  switch (type) {
    case 'PUBLISHED':
      return '#1976d2'; // Blue
    case 'LOCKED':
      return '#d32f2f'; // Red
    default:
      return '#666';
  }
}

function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function ScheduleHistoryPage(): React.ReactElement {
  const { selectedTenantId, selectedPropertyId } = useSelection();
  const { user } = useAuth();

  // Permission checks
  const canViewScheduling = hasPermission(user, SCHEDULING_PERMISSIONS.VIEW);

  // State
  const [selectedSchedulePeriodId, setSelectedSchedulePeriodId] = useState<string | null>(null);

  // Fetch schedule periods
  const periodsQuery = useQuery({
    queryKey: ['schedule-periods', selectedPropertyId],
    queryFn: () =>
      getSchedulePeriods({
        propertyId: selectedPropertyId!,
      }),
    enabled: Boolean(selectedTenantId && selectedPropertyId && canViewScheduling),
  });

  // Fetch events for selected period
  const eventsQuery = useQuery({
    queryKey: ['schedule-events', selectedSchedulePeriodId],
    queryFn: () => {
      if (!selectedSchedulePeriodId) throw new Error('No period selected');
      return getSchedulePeriodEvents(selectedSchedulePeriodId, selectedPropertyId!);
    },
    enabled: Boolean(selectedSchedulePeriodId && canViewScheduling),
  });

  // Handle first period selection on load
  React.useEffect(() => {
    if (periodsQuery.data && periodsQuery.data.length > 0 && !selectedSchedulePeriodId) {
      setSelectedSchedulePeriodId(periodsQuery.data[0].id);
    }
  }, [periodsQuery.data, selectedSchedulePeriodId]);

  if (!selectedPropertyId) {
    return (
      <div className="page-container">
        <h1>Schedule History</h1>
        <div className="panel">
          <p>Please select a property to view schedule history.</p>
        </div>
      </div>
    );
  }

  if (!canViewScheduling) {
    return (
      <div className="page-container">
        <h1>Schedule History</h1>
        <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#d32f2f' }}>You don't have access to scheduling features.</p>
          <small style={{ color: '#666' }}>
            Contact your administrator if you need this permission.
          </small>
        </div>
      </div>
    );
  }

  const renderTimeline = (events: ScheduleEvent[]) => {
    if (events.length === 0) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
          <p>No history recorded for this period.</p>
        </div>
      );
    }

    return (
      <div style={{ padding: '0 1rem' }}>
        {events.map((event, index) => (
          <div
            key={event.id}
            style={{
              display: 'flex',
              gap: '1.5rem',
              paddingBottom: index < events.length - 1 ? '1.5rem' : 0,
              position: 'relative',
            }}
          >
            {/* Timeline connector */}
            {index < events.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: '0.4rem',
                  top: '2rem',
                  width: '2px',
                  height: 'calc(100% + 1.5rem)',
                  backgroundColor: '#ddd',
                }}
              />
            )}

            {/* Timeline dot */}
            <div
              style={{
                width: '0.9rem',
                height: '0.9rem',
                borderRadius: '50%',
                backgroundColor: getEventTypeColor(event.type),
                marginTop: '0.25rem',
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
              }}
            />

            {/* Event content */}
            <div style={{ flex: 1, paddingTop: 0 }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: getEventTypeColor(event.type), fontSize: '1.05rem' }}>
                  {formatEventType(event.type)}
                </strong>
                <span style={{ color: '#999', marginLeft: '0.5rem', fontSize: '0.9rem' }}>
                  {formatDateTime(event.at)}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                By: <strong>{event.byDisplayName || event.byUserId}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1>Schedule History</h1>
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          View the lifecycle events for schedule periods including publish and lock actions.
        </p>
      </div>

      {/* Period selector */}
      <div className="panel" style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="period-selector" style={{ marginBottom: '0.5rem', display: 'block' }}>
          <strong>Select Period</strong>
        </label>
        {periodsQuery.isLoading ? (
          <div style={{ color: '#999' }}>Loading periods...</div>
        ) : periodsQuery.isError ? (
          <div style={{ color: '#d32f2f' }}>Error loading periods</div>
        ) : (
          <select
            id="period-selector"
            className="form-control"
            value={selectedSchedulePeriodId || ''}
            onChange={(e) => setSelectedSchedulePeriodId(e.target.value)}
          >
            <option value="">-- Select a period --</option>
            {periodsQuery.data?.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name || `${period.startDate} to ${period.endDate}`} ({period.status})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Events timeline */}
      <div className="panel">
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Event History</h2>

        {!selectedSchedulePeriodId ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
            <p>Select a period to view its history.</p>
          </div>
        ) : eventsQuery.isLoading ? (
          <LoadingSkeleton />
        ) : eventsQuery.isError ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>
            <p>Error loading history. Please try again.</p>
          </div>
        ) : (
          renderTimeline(eventsQuery.data || [])
        )}
      </div>
    </div>
  );
}

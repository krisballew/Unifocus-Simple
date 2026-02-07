import React from 'react';

import { deleteAvailability } from '../api/availability';
import type { AvailabilityEntry } from '../api/availability';

export interface AvailabilityTableProps {
  entries: AvailabilityEntry[];
  propertyId: string;
  isLoading?: boolean;
  canDelete?: boolean;
  onDelete: () => void;
}

export function AvailabilityTable({
  entries,
  propertyId,
  isLoading = false,
  canDelete = false,
  onDelete,
}: AvailabilityTableProps): React.ReactElement {
  const formatDate = (dateStr: string): string => {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'AVAILABLE':
        return '#4caf50';
      case 'UNAVAILABLE':
        return '#d32f2f';
      case 'PREFERRED':
        return '#2196f3';
      default:
        return '#666';
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!window.confirm('Delete this availability entry?')) {
      return;
    }

    try {
      await deleteAvailability({ id: entryId, propertyId });
      onDelete();
    } catch (error) {
      console.error('Error deleting availability:', error);
      alert('Failed to delete availability entry');
    }
  };

  if (entries.length === 0) {
    return (
      <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#666' }}>No availability entries found for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="page-table">
      <div className="page-table__row page-table__header">
        <div>Date</div>
        <div>Time</div>
        <div>Type</div>
        <div>Recurrence</div>
        <div>Actions</div>
      </div>

      {entries.map((entry) => (
        <div className="page-table__row" key={entry.id}>
          <div>{formatDate(entry.date)}</div>

          <div>
            {entry.startTime} – {entry.endTime}
          </div>

          <div>
            <span
              style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                backgroundColor: getTypeColor(entry.type),
                color: '#fff',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {entry.type}
            </span>
          </div>

          <div>{entry.recurrenceRule ? 'Yes' : '—'}</div>

          <div>
            {canDelete && (
              <button
                type="button"
                className="button button--small button--danger"
                onClick={() => handleDelete(entry.id)}
                disabled={isLoading}
                title="Delete this entry"
              >
                Delete
              </button>
            )}
            {!canDelete && <span style={{ color: '#999' }}>—</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

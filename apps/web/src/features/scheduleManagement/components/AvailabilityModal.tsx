import React, { useState } from 'react';

import type { AvailabilityType } from '../api/availability';

export interface AvailabilityModalProps {
  onClose: () => void;
  onSubmit: (data: {
    date: string;
    startTime: string;
    endTime: string;
    type: AvailabilityType;
    recurrenceRule?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function AvailabilityModal({
  onClose,
  onSubmit,
  isLoading = false,
}: AvailabilityModalProps): React.ReactElement {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    type: 'AVAILABLE' as AvailabilityType,
    recurrenceRule: '',
  });

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.date) {
      setError('Date is required');
      return;
    }

    if (!formData.startTime) {
      setError('Start time is required');
      return;
    }

    if (!formData.endTime) {
      setError('End time is required');
      return;
    }

    if (formData.endTime <= formData.startTime) {
      setError('End time must be after start time');
      return;
    }

    try {
      await onSubmit({
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        type: formData.type,
        recurrenceRule: formData.recurrenceRule || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create availability entry');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Availability</h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  backgroundColor: '#ffebee',
                  border: '1px solid #ef5350',
                  borderRadius: '4px',
                  color: '#c62828',
                  fontSize: '0.875rem',
                }}
              >
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="availability-date">Date</label>
              <input
                id="availability-date"
                type="date"
                className="form-control"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                disabled={isLoading}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="start-time">Start Time</label>
                <input
                  id="start-time"
                  type="time"
                  className="form-control"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="end-time">End Time</label>
                <input
                  id="end-time"
                  type="time"
                  className="form-control"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="type">Type</label>
              <select
                id="type"
                className="form-control"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as AvailabilityType })
                }
                disabled={isLoading}
              >
                <option value="AVAILABLE">Available</option>
                <option value="UNAVAILABLE">Unavailable</option>
                <option value="PREFERRED">Preferred</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="recurrence">
                Recurrence Rule <small>(optional)</small>
              </label>
              <input
                id="recurrence"
                type="text"
                className="form-control"
                value={formData.recurrenceRule}
                onChange={(e) => setFormData({ ...formData, recurrenceRule: e.target.value })}
                placeholder="e.g., FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
                disabled={isLoading}
              />
              <small className="text-muted">
                Leave empty for one-time entry, or enter an iCalendar recurrence rule.
              </small>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button type="submit" className="button button--primary" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

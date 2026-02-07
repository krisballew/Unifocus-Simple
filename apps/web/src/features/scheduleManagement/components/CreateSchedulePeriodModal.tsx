import React, { useState } from 'react';

import type { CreateSchedulePeriodParams } from '../../../services/api-client';

export interface CreateSchedulePeriodModalProps {
  propertyId: string;
  onClose: () => void;
  onCreate: (params: CreateSchedulePeriodParams) => void;
  isLoading?: boolean;
}

export function CreateSchedulePeriodModal({
  propertyId,
  onClose,
  onCreate,
  isLoading = false,
}: CreateSchedulePeriodModalProps): React.ReactElement {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    // Convert date strings to ISO datetime strings (start of day)
    const startDateTime = new Date(startDate + 'T00:00:00.000Z').toISOString();
    const endDateTime = new Date(endDate + 'T23:59:59.999Z').toISOString();

    onCreate({
      propertyId,
      startDate: startDateTime,
      endDate: endDateTime,
      name: name.trim() || undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Schedule Period</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="period-name">
                Period Name <span className="text-muted">(optional)</span>
              </label>
              <input
                id="period-name"
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Week of Jan 15"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="start-date">
                Start Date <span className="text-required">*</span>
              </label>
              <input
                id="start-date"
                type="date"
                className="form-control"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="end-date">
                End Date <span className="text-required">*</span>
              </label>
              <input
                id="end-date"
                type="date"
                className="form-control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate}
                disabled={isLoading}
              />
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
            <button
              type="submit"
              className="button button--primary"
              disabled={isLoading || !startDate || !endDate}
            >
              {isLoading ? 'Creating...' : 'Create Period'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

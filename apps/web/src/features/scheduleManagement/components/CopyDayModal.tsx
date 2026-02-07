import React, { useState } from 'react';

interface CopyDayModalProps {
  periodDays: string[];
  selectedDate: string;
  onClose: () => void;
  onSubmit: (sourceDate: string, targetDate: string, options: CopyDayOptions) => void;
  isLoading: boolean;
  canAssign: boolean;
}

export interface CopyDayOptions {
  includeAssignments: boolean;
  setAsOpenShifts: boolean;
}

export function CopyDayModal({
  periodDays,
  selectedDate,
  onClose,
  onSubmit,
  isLoading,
  canAssign,
}: CopyDayModalProps): React.ReactElement {
  const [sourceDate, setSourceDate] = useState('');
  const [targetDate, setTargetDate] = useState(selectedDate);
  const [includeAssignments, setIncludeAssignments] = useState(false);
  const [setAsOpenShifts, setSetAsOpenShifts] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!sourceDate || !targetDate) {
      alert('Please select both source and target dates');
      return;
    }

    if (sourceDate === targetDate) {
      alert('Source and target dates must be different');
      return;
    }

    if (includeAssignments && !canAssign) {
      alert('You do not have permission to assign employees to shifts');
      return;
    }

    onSubmit(sourceDate, targetDate, { includeAssignments, setAsOpenShifts });
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px' }}
      >
        <div className="modal-header">
          <h3>Copy Day Shifts</h3>
          <button type="button" className="modal-close" onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ marginBottom: '1.5rem', color: 'var(--brand-muted)' }}>
              Copy all shifts from one day to another within the same schedule period.
            </p>

            <div className="form-group">
              <label htmlFor="source-date">
                Source Date <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                id="source-date"
                className="form-control"
                value={sourceDate}
                onChange={(e) => setSourceDate(e.target.value)}
                required
                disabled={isLoading}
              >
                <option value="">Select source date</option>
                {periodDays.map((day) => (
                  <option key={day} value={day}>
                    {formatDate(day)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="target-date">
                Target Date <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                id="target-date"
                className="form-control"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
                disabled={isLoading}
              >
                <option value="">Select target date</option>
                {periodDays.map((day) => (
                  <option key={day} value={day}>
                    {formatDate(day)}
                  </option>
                ))}
              </select>
            </div>

            <hr />

            <div style={{ marginBottom: '1rem' }}>
              <strong>Options</strong>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={includeAssignments}
                  onChange={(e) => setIncludeAssignments(e.target.checked)}
                  disabled={isLoading || !canAssign}
                  style={{ marginRight: '8px' }}
                />
                Include employee assignments
              </label>
              {includeAssignments && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'rgba(255, 193, 7, 0.1)',
                    border: '1px solid rgba(255, 193, 7, 0.3)',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                  }}
                >
                  <strong>⚠️ Warning:</strong> This will attempt to assign the same employees to the
                  copied shifts. Employees may already have shifts on the target date, which could
                  result in conflicts.
                </div>
              )}
              {!canAssign && (
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--brand-muted)',
                    marginTop: '0.25rem',
                  }}
                >
                  You do not have permission to assign employees (requires scheduling.assign)
                </div>
              )}
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={setAsOpenShifts}
                  onChange={(e) => setSetAsOpenShifts(e.target.checked)}
                  disabled={isLoading || includeAssignments}
                  style={{ marginRight: '8px' }}
                />
                Set copied shifts as open (no assignments)
              </label>
              {includeAssignments && (
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--brand-muted)',
                    marginTop: '0.25rem',
                  }}
                >
                  Disabled when including assignments
                </div>
              )}
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
              {isLoading ? 'Copying...' : 'Copy Shifts'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

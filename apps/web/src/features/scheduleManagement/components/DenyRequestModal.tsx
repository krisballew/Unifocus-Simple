import React, { useState } from 'react';

export interface DenyRequestModalProps {
  requestId: string;
  onClose: () => void;
  onDeny: (reason?: string) => void;
  isLoading?: boolean;
}

export function DenyRequestModal({
  onClose,
  onDeny,
  isLoading = false,
}: DenyRequestModalProps): React.ReactElement {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDeny(reason || undefined);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Deny Request</h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="denial-reason">
                Reason for Denial <small>(optional)</small>
              </label>
              <textarea
                id="denial-reason"
                className="form-control"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for denying this request..."
                rows={4}
                disabled={isLoading}
              />
              <small className="text-muted">
                This reason will be visible to the employee who submitted the request.
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
            <button type="submit" className="button button--danger" disabled={isLoading}>
              {isLoading ? 'Denying...' : 'Deny Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

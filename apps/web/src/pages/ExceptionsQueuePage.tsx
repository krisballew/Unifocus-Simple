import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { getExceptions, resolveException } from '../services/api-client';
import { queryKeys } from '../services/query-keys';

export function ExceptionsQueuePage(): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const exceptionsQuery = useQuery({
    queryKey: queryKeys.exceptions('pending'),
    queryFn: () => getExceptions('pending'),
    refetchInterval: 30_000,
  });

  const resolveMutation = useMutation({
    mutationFn: (params: { id: string; status: 'approved' | 'rejected' }) =>
      resolveException(params.id, params.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exceptions() });
      setSelectedId(null);
    },
  });

  if (exceptionsQuery.isLoading) {
    return <LoadingSkeleton lines={8} card />;
  }

  const exceptions = exceptionsQuery.data ?? [];
  const selected = exceptions.find((e) => e.id === selectedId);

  return (
    <div className="exceptions-queue">
      <div className="exceptions-queue__list">
        <h2>Pending Exceptions ({exceptions.length})</h2>
        {exceptions.length === 0 ? (
          <p className="exceptions-queue__empty">No pending exceptions</p>
        ) : (
          <div className="exception-cards">
            {exceptions.map((exc) => (
              <button
                key={exc.id}
                className={`exception-card ${selectedId === exc.id ? 'exception-card--selected' : ''}`}
                onClick={() => setSelectedId(exc.id)}
                type="button"
              >
                <p className="exception-card__type">{exc.type}</p>
                <p className="exception-card__date">{new Date(exc.date).toLocaleDateString()}</p>
                <p className="exception-card__reason">{exc.reason || 'No details'}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="exceptions-queue__drawer">
          <div className="drawer-header">
            <h3>Exception Details</h3>
            <button className="drawer-close" onClick={() => setSelectedId(null)} type="button">
              ✕
            </button>
          </div>

          <div className="drawer-content">
            <div className="drawer-field">
              <label>Type</label>
              <p>{selected.type}</p>
            </div>

            <div className="drawer-field">
              <label>Date</label>
              <p>{new Date(selected.date).toLocaleDateString()}</p>
            </div>

            <div className="drawer-field">
              <label>Reason</label>
              <p>{selected.reason || 'N/A'}</p>
            </div>

            {selected.startTime && (
              <div className="drawer-field">
                <label>Time</label>
                <p>
                  {selected.startTime}
                  {selected.endTime ? ` - ${selected.endTime}` : ''}
                </p>
              </div>
            )}

            <div className="drawer-actions">
              <button
                className="btn btn--approve"
                onClick={() => resolveMutation.mutate({ id: selected.id, status: 'approved' })}
                disabled={resolveMutation.isPending}
                type="button"
              >
                {resolveMutation.isPending ? 'Approving...' : 'Approve'}
              </button>
              <button
                className="btn btn--reject"
                onClick={() => resolveMutation.mutate({ id: selected.id, status: 'rejected' })}
                disabled={resolveMutation.isPending}
                type="button"
              >
                {resolveMutation.isPending ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

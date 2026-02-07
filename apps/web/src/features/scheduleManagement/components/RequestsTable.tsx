import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import { approveRequest, denyRequest } from '../api/requests';
import type { SchedulingRequest } from '../api/requests';
import { useScheduleLookups } from '../hooks/useScheduleLookups';
import { formatApiError } from '../utils/apiErrors';

import { DenyRequestModal } from './DenyRequestModal';
import { RequestTypeBadge } from './RequestTypeBadge';

export interface RequestsTableProps {
  requests: SchedulingRequest[];
  propertyId: string;
  onRequestUpdated?: () => void;
}

export function RequestsTable({
  requests,
  propertyId,
  onRequestUpdated,
}: RequestsTableProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [denyingRequestId, setDenyingRequestId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  // Fetch lookups for resolving IDs to names
  const lookups = useScheduleLookups(propertyId);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveRequest(requestId, { propertyId }),
    onSuccess: (_data, requestId) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      onRequestUpdated?.();
    },
    onError: (error, requestId) => {
      setRowErrors((prev) => ({ ...prev, [requestId]: formatApiError(error) }));
    },
  });

  // Deny mutation
  const denyMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      denyRequest(requestId, { propertyId, reason }),
    onSuccess: (_data, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      setDenyingRequestId(null);
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      onRequestUpdated?.();
    },
    onError: (error, { requestId }) => {
      setRowErrors((prev) => ({ ...prev, [requestId]: formatApiError(error) }));
      setDenyingRequestId(null);
    },
  });

  const formatTime = (dateTimeStr: string): string => {
    const date = new Date(dateTimeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateTimeStr: string): string => {
    const date = new Date(dateTimeStr);
    return date.toLocaleDateString();
  };

  const formatRequestor = (request: SchedulingRequest): string => {
    if (request.requester) {
      const name = `${request.requester.lastName}, ${request.requester.firstName}`;
      if (request.requester.employeeNumber) {
        return `${name} (${request.requester.employeeNumber})`;
      }
      return name;
    }
    return request.requesterId;
  };

  const formatEmployee = (request: SchedulingRequest): string => {
    if (!request.toEmployee) return '—';
    const name = `${request.toEmployee.lastName}, ${request.toEmployee.firstName}`;
    if (request.toEmployee.employeeNumber) {
      return `${name} (${request.toEmployee.employeeNumber})`;
    }
    return name;
  };

  const getDepartmentName = (request: SchedulingRequest): string => {
    if (!request.shift) return '—';
    const deptId = request.shift.departmentId;
    // Use looked up data first, then nested data, then ID
    if (lookups.departmentsById[deptId]) {
      return lookups.departmentsById[deptId].name;
    }
    return request.shift.department?.name || deptId || '—';
  };

  const getJobRoleName = (request: SchedulingRequest): string => {
    if (!request.shift) return '—';
    const roleId = request.shift.jobRoleId;
    // Use looked up data first, then nested data, then ID
    if (lookups.jobRolesById[roleId]) {
      return lookups.jobRolesById[roleId].name;
    }
    return request.shift.jobRole?.name || roleId || '—';
  };

  return (
    <>
      <div className="page-table">
        <div className="page-table__row page-table__header">
          <div>Type</div>
          <div>Date & Time</div>
          <div>Department</div>
          <div>Job Role</div>
          <div>Requestor</div>
          <div>Target Employee</div>
          <div>Actions</div>
        </div>

        {requests.map((request) => {
          const isProcessing = approveMutation.isPending || denyMutation.isPending;

          return (
            <div className="page-table__row" key={request.id}>
              <div>
                <RequestTypeBadge request={request} />
              </div>

              <div>
                {request.shift && (
                  <div>
                    <div style={{ fontSize: '0.875rem' }}>
                      {formatDate(request.shift.startDateTime)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>
                      {formatTime(request.shift.startDateTime)} -{' '}
                      {formatTime(request.shift.endDateTime)}
                    </div>
                  </div>
                )}
              </div>

              <div>{getDepartmentName(request)}</div>

              <div>{getJobRoleName(request)}</div>

              <div>{formatRequestor(request)}</div>

              <div>{formatEmployee(request)}</div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: rowErrors[request.id] ? '0.5rem' : 0,
                  }}
                >
                  <button
                    type="button"
                    className="button button--small button--primary"
                    onClick={() => approveMutation.mutate(request.id)}
                    disabled={isProcessing}
                    title="Approve this request"
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className="button button--small button--danger"
                    onClick={() => setDenyingRequestId(request.id)}
                    disabled={isProcessing}
                    title="Deny this request"
                  >
                    {denyMutation.isPending ? 'Denying...' : 'Deny'}
                  </button>
                </div>
                {rowErrors[request.id] && (
                  <div style={{ fontSize: '0.875rem', color: '#d32f2f', marginTop: '0.25rem' }}>
                    {rowErrors[request.id]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {denyingRequestId && (
        <DenyRequestModal
          requestId={denyingRequestId}
          onClose={() => setDenyingRequestId(null)}
          onDeny={(reason?: string) => {
            denyMutation.mutate({ requestId: denyingRequestId, reason });
          }}
          isLoading={denyMutation.isPending}
        />
      )}
    </>
  );
}

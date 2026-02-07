import React, { useState } from 'react';

import type { Shift } from '../api/shifts';

export interface AssignEmployeesModalProps {
  shift: Shift;
  onClose: () => void;
  onAssign: (employeeId: string) => void;
  onUnassign: (employeeId: string) => void;
  isLoading?: boolean;
}

export function AssignEmployeesModal({
  shift,
  onClose,
  onAssign,
  onUnassign,
  isLoading = false,
}: AssignEmployeesModalProps): React.ReactElement {
  const [employeeId, setEmployeeId] = useState('');

  const handleAssign = () => {
    if (!employeeId.trim()) {
      alert('Please enter an employee ID');
      return;
    }
    onAssign(employeeId.trim());
    setEmployeeId('');
  };

  const handleUnassign = (empId: string) => {
    if (window.confirm('Remove this employee from the shift?')) {
      onUnassign(empId);
    }
  };

  const formatTime = (dateTimeStr: string): string => {
    const date = new Date(dateTimeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Assignments</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Shift Details</h3>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              <div>
                Time: {formatTime(shift.startDateTime)} - {formatTime(shift.endDateTime)}
              </div>
              <div>Department: {shift.department?.name || shift.departmentId}</div>
              <div>Job Role: {shift.jobRole?.name || shift.jobRoleId}</div>
              <div>Status: {shift.isOpenShift ? 'Open Shift' : 'Assigned'}</div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="employee-id">Add Employee by ID</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="employee-id"
                type="text"
                className="form-control"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="Enter employee ID"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAssign();
                  }
                }}
              />
              <button
                type="button"
                className="button button--primary"
                onClick={handleAssign}
                disabled={isLoading || !employeeId.trim()}
              >
                Assign
              </button>
            </div>
            <small className="text-muted">
              TODO: Replace with employee search/selector with eligibility checks
            </small>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>
              Current Assignments ({shift.assignments?.length || 0})
            </h3>

            {!shift.assignments || shift.assignments.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>No employees assigned yet</p>
            ) : (
              <div className="page-table">
                <div className="page-table__row page-table__header">
                  <div>Employee ID</div>
                  <div>Name</div>
                  <div>Email</div>
                  <div>Actions</div>
                </div>
                {shift.assignments.map((assignment) => (
                  <div className="page-table__row" key={assignment.id}>
                    <div>{assignment.employeeId}</div>
                    <div>
                      {assignment.employee
                        ? `${assignment.employee.firstName} ${assignment.employee.lastName}`
                        : '—'}
                    </div>
                    <div>{assignment.employee?.email || '—'}</div>
                    <div>
                      <button
                        type="button"
                        className="button button--small button--danger"
                        onClick={() => handleUnassign(assignment.employeeId)}
                        disabled={isLoading}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

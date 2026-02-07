import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';

import { getEmployees } from '../api/lookups';
import type { EmployeeLookup } from '../api/lookups';
import type { Shift } from '../api/shifts';
import { formatEmployeeLabel } from '../utils/labels';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Query employees when search query is at least 2 characters
  const employeesQuery = useQuery({
    queryKey: ['employees', shift.propertyId, shift.departmentId, searchQuery],
    queryFn: () =>
      getEmployees({
        propertyId: shift.propertyId,
        departmentId: shift.departmentId,
        q: searchQuery,
      }),
    enabled: searchQuery.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const handleAssignEmployee = (employee: EmployeeLookup) => {
    onAssign(employee.id);
    setSearchQuery('');
    setShowResults(false);
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
            <label htmlFor="employee-search">Search Employees</label>
            <div style={{ position: 'relative' }}>
              <input
                id="employee-search"
                type="text"
                className="form-control"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(e.target.value.length >= 2);
                }}
                onFocus={() => {
                  if (searchQuery.length >= 2) {
                    setShowResults(true);
                  }
                }}
                placeholder="Type at least 2 characters to search..."
                disabled={isLoading}
              />

              {showResults && searchQuery.length >= 2 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderTop: 'none',
                    borderRadius: '0 0 4px 4px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 10,
                  }}
                >
                  {employeesQuery.isLoading && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                      Loading...
                    </div>
                  )}
                  {employeesQuery.isError && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#d32f2f' }}>
                      Error loading employees
                    </div>
                  )}
                  {employeesQuery.data && employeesQuery.data.length === 0 && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                      No employees found
                    </div>
                  )}
                  {employeesQuery.data && employeesQuery.data.length > 0 && (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {employeesQuery.data.map((employee) => (
                        <li key={employee.id}>
                          <button
                            type="button"
                            onClick={() => handleAssignEmployee(employee)}
                            disabled={isLoading}
                            style={{
                              width: '100%',
                              padding: '0.75rem 1rem',
                              textAlign: 'left',
                              border: 'none',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f0f0f0',
                              fontSize: '0.875rem',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f5';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor =
                                'transparent';
                            }}
                          >
                            {formatEmployeeLabel(employee)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <small className="text-muted">Search by name, email, or employee number</small>
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

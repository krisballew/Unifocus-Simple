import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';

import { EmploymentDetailsModal } from '../components/EmploymentDetailsModal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useSelection } from '../context/SelectionContext';
import { useAuth } from '../hooks/useAuth';
import {
  createEmployee,
  getEmployees,
  updateEmployee,
  type Employee,
} from '../services/api-client';
import { queryKeys } from '../services/query-keys';

interface EmployeeFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hireDate: string;
}

const emptyForm: EmployeeFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  hireDate: '',
};

export function HrManagementPage(): React.ReactElement {
  const { selectedPropertyId, selectedTenantId } = useSelection();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [formState, setFormState] = useState<EmployeeFormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [showEmploymentDetails, setShowEmploymentDetails] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [showTerminationDialog, setShowTerminationDialog] = useState(false);
  const [terminationEmployeeId, setTerminationEmployeeId] = useState<string | null>(null);
  const [terminationDate, setTerminationDate] = useState('');
  const [terminationReason, setTerminationReason] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
  };

  const employeesQuery = useQuery({
    queryKey: queryKeys.employees(selectedPropertyId ?? undefined),
    queryFn: () => getEmployees(selectedPropertyId ?? undefined),
    enabled: Boolean(selectedTenantId),
  });

  const sortedEmployees = useMemo(() => {
    const employees = employeesQuery.data ?? [];
    const filtered = searchTerm
      ? employees.filter(
          (e) =>
            e.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (e.email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      : employees;
    return [...filtered].sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [employeesQuery.data, searchTerm]);

  const createMutation = useMutation({
    mutationFn: (payload: {
      propertyId: string;
      firstName: string;
      lastName: string;
      email?: string | null;
      phone?: string | null;
      hireDate?: string | null;
    }) => createEmployee(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees(selectedPropertyId ?? undefined),
      });
      setFormState(emptyForm);
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { employeeId: string; data: Partial<EmployeeFormState> }) =>
      updateEmployee(payload.employeeId, {
        firstName: payload.data.firstName,
        lastName: payload.data.lastName,
        email: payload.data.email || null,
        phone: payload.data.phone || null,
        hireDate: payload.data.hireDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees(selectedPropertyId ?? undefined),
      });
      setEditingEmployeeId(null);
      setFormState(emptyForm);
    },
  });

  const selectedEmployee = useMemo(
    () => sortedEmployees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [sortedEmployees, selectedEmployeeId]
  );

  const _handleEdit = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setFormState({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      hireDate: employee.hireDate ? employee.hireDate.split('T')[0] : '',
    });
  };

  const handleSave = () => {
    if (!selectedPropertyId) return;

    if (editingEmployeeId) {
      updateMutation.mutate({ employeeId: editingEmployeeId, data: formState });
      return;
    }

    createMutation.mutate({
      propertyId: selectedPropertyId,
      firstName: formState.firstName.trim(),
      lastName: formState.lastName.trim(),
      email: formState.email.trim() || null,
      phone: formState.phone.trim() || null,
      hireDate: formState.hireDate || null,
    });
  };

  if (employeesQuery.isLoading) {
    return <LoadingSkeleton lines={10} card />;
  }

  if (employeesQuery.isError) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>HR Management</h1>
          <p className="page-description">Failed to load employees.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status">
          {toast.message}
        </div>
      )}
      <div className="page-header">
        <h1>HR Management</h1>
        <p className="page-description">
          Manage employee profiles, onboarding details, and active status.
        </p>
      </div>

      <div className="hr-toolbar">
        <input
          className="hr-search-input"
          type="text"
          placeholder="Search employees by name or email"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button
          className="link-button"
          type="button"
          onClick={() => {
            setShowForm((prev) => !prev);
            setEditingEmployeeId(null);
            setSelectedEmployeeId('');
            setFormState(emptyForm);
          }}
        >
          Add
        </button>
        <button
          className={`link-button hr-employment-link${!selectedEmployee ? ' is-disabled' : ''}`}
          type="button"
          aria-disabled={!selectedEmployee}
          onClick={() => {
            if (!selectedEmployee) {
              showToast('Please select an employee first.', 'error');
              return;
            }
            setShowEmploymentDetails(true);
          }}
        >
          Employment Details
        </button>
        {!selectedPropertyId && (
          <span className="hr-helper">Select a property to add employees.</span>
        )}
      </div>

      {showForm && (
        <div className="hr-form">
          <div className="hr-form-grid">
            <div className="hr-form-field">
              <label>First name</label>
              <input
                type="text"
                value={formState.firstName}
                onChange={(e) => setFormState((prev) => ({ ...prev, firstName: e.target.value }))}
              />
            </div>
            <div className="hr-form-field">
              <label>Last name</label>
              <input
                type="text"
                value={formState.lastName}
                onChange={(e) => setFormState((prev) => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
            <div className="hr-form-field">
              <label>Email</label>
              <input
                type="email"
                value={formState.email}
                onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="hr-form-field">
              <label>Phone</label>
              <input
                type="tel"
                value={formState.phone}
                onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="hr-form-field">
              <label>Hire date</label>
              <input
                type="date"
                value={formState.hireDate}
                onChange={(e) => setFormState((prev) => ({ ...prev, hireDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="hr-form-actions">
            <button
              className="button primary"
              type="button"
              onClick={handleSave}
              disabled={!selectedPropertyId || createMutation.isPending || updateMutation.isPending}
            >
              {editingEmployeeId ? 'Save changes' : 'Create employee'}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setEditingEmployeeId(null);
                setFormState(emptyForm);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <EmploymentDetailsModal
        isOpen={showEmploymentDetails}
        onClose={() => setShowEmploymentDetails(false)}
        employee={selectedEmployee}
        selectedPropertyId={selectedPropertyId}
      />

      {showTerminationDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.1rem' }}>
              Terminate Employment
            </h3>
            <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Please provide the termination date and reason.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  marginBottom: '4px',
                  fontWeight: 500,
                }}
              >
                Termination Date *
              </label>
              <input
                type="date"
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '0.9rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  marginBottom: '4px',
                  fontWeight: 500,
                }}
              >
                Termination Reason *
              </label>
              <textarea
                value={terminationReason}
                onChange={(e) => setTerminationReason(e.target.value)}
                placeholder="e.g., Resignation, Retirement, Layoff, etc."
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '0.9rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  minHeight: '80px',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowTerminationDialog(false);
                  setTerminationEmployeeId(null);
                  setTerminationDate('');
                  setTerminationReason('');
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!terminationDate || !terminationReason.trim()) {
                    alert('Please provide both termination date and reason');
                    return;
                  }
                  if (!terminationEmployeeId) return;

                  try {
                    await updateEmployee(terminationEmployeeId, {
                      employmentStatus: 'terminated',
                      terminationDate,
                      terminationReason,
                      employmentStatusChangedBy: user?.name || user?.username || 'Unknown User',
                    });
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.employees(selectedPropertyId ?? undefined),
                    });
                    setShowTerminationDialog(false);
                    setTerminationEmployeeId(null);
                    setTerminationDate('');
                    setTerminationReason('');
                    showToast('Employment terminated successfully');
                  } catch (error) {
                    console.error('Failed to terminate employment:', error);
                    showToast('Failed to terminate employment', 'error');
                  }
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: 'var(--brand-primary)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-table">
        <div className="page-table__row page-table__header">
          <div>Employee ID</div>
          <div>Name</div>
          <div>Email</div>
          <div>Property</div>
          <div>Hire Date</div>
          <div>Employment Status</div>
          <div>Changed On</div>
          <div>Changed By</div>
        </div>
        {sortedEmployees.map((employee) => (
          <div
            className={`page-table__row ${
              employee.id === selectedEmployeeId ? 'is-selected' : 'is-selectable'
            }`}
            key={employee.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedEmployeeId(employee.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedEmployeeId(employee.id);
              }
            }}
            onDoubleClick={() => {
              setSelectedEmployeeId(employee.id);
              setShowEmploymentDetails(true);
            }}
          >
            <div>{employee.employeeId ?? '—'}</div>
            <div>
              {employee.firstName} {employee.lastName}
            </div>
            <div>{employee.email ?? '—'}</div>
            <div>{employee.property?.name ?? '—'}</div>
            <div>{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : '—'}</div>
            <div>
              <select
                value={
                  (employee as Employee & { employmentStatus?: string }).employmentStatus ||
                  'active'
                }
                onChange={async (e) => {
                  e.stopPropagation();
                  const newStatus = e.target.value;
                  if (newStatus === 'terminated') {
                    setTerminationEmployeeId(employee.id);
                    setTerminationDate('');
                    setTerminationReason('');
                    setShowTerminationDialog(true);
                  } else {
                    try {
                      await updateEmployee(employee.id, {
                        employmentStatus: newStatus,
                        employmentStatusChangedBy: user?.name || user?.username || 'Unknown User',
                      });
                      queryClient.invalidateQueries({
                        queryKey: queryKeys.employees(selectedPropertyId ?? undefined),
                      });
                      showToast('Employment status updated');
                    } catch (error) {
                      console.error('Failed to update status:', error);
                      showToast('Failed to update status', 'error');
                    }
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.9rem',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                <option value="active">Active</option>
                <option value="leave">Leave of Absence</option>
                <option value="terminated">Terminated</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              {(employee as Employee & { employmentStatusChangedOn?: string })
                .employmentStatusChangedOn
                ? new Date(
                    (employee as Employee & { employmentStatusChangedOn?: string })
                      .employmentStatusChangedOn!
                  ).toLocaleDateString()
                : '—'}
            </div>
            <div>
              {(employee as Employee & { employmentStatusChangedBy?: string })
                .employmentStatusChangedBy || '—'}
            </div>
          </div>
        ))}
        {sortedEmployees.length === 0 && (
          <div className="page-table__row">
            <div>No employees found.</div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';

import { EmploymentDetailsModal } from '../components/EmploymentDetailsModal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useSelection } from '../context/SelectionContext';
import {
  createEmployee,
  deactivateEmployee,
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
  const queryClient = useQueryClient();
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [formState, setFormState] = useState<EmployeeFormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [showEmploymentDetails, setShowEmploymentDetails] = useState(false);

  const employeesQuery = useQuery({
    queryKey: queryKeys.employees(selectedPropertyId ?? undefined),
    queryFn: () => getEmployees(selectedPropertyId ?? undefined),
    enabled: Boolean(selectedTenantId),
  });

  const sortedEmployees = useMemo(() => {
    const employees = employeesQuery.data ?? [];
    return [...employees].sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [employeesQuery.data]);

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

  const deactivateMutation = useMutation({
    mutationFn: (employeeId: string) => deactivateEmployee(employeeId),
    onSuccess: (updated) => {
      queryClient.setQueryData<Employee[]>(
        queryKeys.employees(selectedPropertyId ?? undefined),
        (current) =>
          (current ?? []).map((employee) =>
            employee.id === updated.id ? { ...employee, isActive: updated.isActive } : employee
          )
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees(selectedPropertyId ?? undefined),
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (employeeId: string) => updateEmployee(employeeId, { isActive: true }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Employee[]>(
        queryKeys.employees(selectedPropertyId ?? undefined),
        (current) =>
          (current ?? []).map((employee) =>
            employee.id === updated.id ? { ...employee, isActive: updated.isActive } : employee
          )
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees(selectedPropertyId ?? undefined),
      });
    },
  });

  const selectedEmployee = useMemo(
    () => sortedEmployees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [sortedEmployees, selectedEmployeeId]
  );

  const handleEdit = (employee: Employee) => {
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
      <div className="page-header">
        <h1>HR Management</h1>
        <p className="page-description">
          Manage employee profiles, onboarding details, and active status.
        </p>
      </div>

      <div className="hr-toolbar">
        <span className={`hr-helper ${selectedEmployee ? 'hr-selected' : ''}`}>
          {selectedEmployee
            ? `Selected: ${selectedEmployee.firstName} ${selectedEmployee.lastName}`
            : 'Select an employee from the list to edit or change status.'}
        </span>
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
        <div className="hr-actions">
          <button
            className="link-button"
            type="button"
            onClick={() => selectedEmployee && handleEdit(selectedEmployee)}
            disabled={!selectedEmployee}
          >
            Edit
          </button>
        </div>
        <button
          className="link-button hr-employment-link"
          type="button"
          disabled={!selectedEmployee}
          onClick={() => {
            if (!selectedEmployee) return;
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

      <div className="page-table">
        <div className="page-table__row page-table__header">
          <div>Name</div>
          <div>Email</div>
          <div>Property</div>
          <div>Hire Date</div>
          <div>Status</div>
          <div>Action</div>
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
          >
            <div>
              {employee.firstName} {employee.lastName}
            </div>
            <div>{employee.email ?? '—'}</div>
            <div>{employee.property?.name ?? '—'}</div>
            <div>{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : '—'}</div>
            <div>{employee.isActive ? 'Active' : 'Inactive'}</div>
            <div>
              <button
                className="link-button"
                type="button"
                onClick={() =>
                  employee.isActive
                    ? deactivateMutation.mutate(employee.id)
                    : activateMutation.mutate(employee.id)
                }
                disabled={deactivateMutation.isPending || activateMutation.isPending}
              >
                {employee.isActive ? 'Deactivate' : 'Activate'}
              </button>
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

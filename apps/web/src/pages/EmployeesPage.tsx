import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useSelection } from '../context/SelectionContext';
import { getEmployees } from '../services/api-client';

export function EmployeesPage(): React.ReactElement {
  const { selectedTenantId, selectedPropertyId } = useSelection();

  const employeesQuery = useQuery({
    queryKey: ['employees', selectedPropertyId ?? 'all'],
    queryFn: () => getEmployees(selectedPropertyId ?? undefined),
    enabled: Boolean(selectedTenantId),
  });

  if (employeesQuery.isLoading) {
    return <LoadingSkeleton lines={10} card />;
  }

  if (employeesQuery.isError) {
    return (
      <div className="placeholder">
        <h2>Employees</h2>
        <p>Failed to load employees.</p>
      </div>
    );
  }

  const employees = employeesQuery.data ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <h2>Employees</h2>
        <p>Showing {employees.length} employees.</p>
      </div>

      <div className="page-table">
        <div className="page-table__row page-table__header">
          <div>Name</div>
          <div>Email</div>
          <div>Property</div>
          <div>Hire Date</div>
          <div>Status</div>
        </div>
        {employees.map((employee) => (
          <div className="page-table__row" key={employee.id}>
            <div>
              {employee.firstName} {employee.lastName}
            </div>
            <div>{employee.email ?? '—'}</div>
            <div>{employee.property?.name ?? '—'}</div>
            <div>{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : '—'}</div>
            <div>{employee.isActive ? 'Active' : 'Inactive'}</div>
          </div>
        ))}
        {employees.length === 0 && (
          <div className="page-table__row">
            <div>No employees found.</div>
          </div>
        )}
      </div>
    </div>
  );
}

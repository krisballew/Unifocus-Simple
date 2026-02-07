import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';

import { getEmployees } from '../api/lookups';
import type { EmployeeLookup } from '../api/lookups';

export interface AvailabilityFiltersProps {
  propertyId: string;
  selectedEmployeeId: string | null;
  onEmployeeChange: (employeeId: string | null) => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
}

export function AvailabilityFilters({
  propertyId,
  selectedEmployeeId,
  onEmployeeChange,
  dateRange,
  onDateRangeChange,
}: AvailabilityFiltersProps): React.ReactElement {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeResults, setShowEmployeeResults] = useState(false);

  // Fetch employees for search
  const employeesQuery = useQuery({
    queryKey: ['employees', propertyId, employeeSearch],
    queryFn: () =>
      getEmployees({
        propertyId,
        q: employeeSearch,
      }),
    enabled: employeeSearch.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const formatEmployeeLabel = (emp: EmployeeLookup): string => {
    const name = `${emp.lastName}, ${emp.firstName}`;
    if (emp.employeeNumber) {
      return `${name} (${emp.employeeNumber})`;
    }
    return name;
  };

  const selectedEmployee = employeesQuery.data?.find((emp) => emp.id === selectedEmployeeId);

  const handleEmployeeSelect = (employee: EmployeeLookup) => {
    onEmployeeChange(employee.id);
    setEmployeeSearch(formatEmployeeLabel(employee));
    setShowEmployeeResults(false);
  };

  return (
    <div className="panel" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Filters</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        {/* Employee Search */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="employee-search">Employee</label>
          <div style={{ position: 'relative' }}>
            <input
              id="employee-search"
              type="text"
              className="form-control"
              value={selectedEmployee ? formatEmployeeLabel(selectedEmployee) : employeeSearch}
              onChange={(e) => {
                setEmployeeSearch(e.target.value);
                setShowEmployeeResults(e.target.value.length >= 2);
                if (
                  e.target.value !== formatEmployeeLabel(selectedEmployee || ({} as EmployeeLookup))
                ) {
                  onEmployeeChange(null);
                }
              }}
              onFocus={() => {
                if (employeeSearch.length >= 2) {
                  setShowEmployeeResults(true);
                }
              }}
              placeholder="Search by name..."
            />

            {showEmployeeResults && employeeSearch.length >= 2 && (
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
                  maxHeight: '250px',
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
                          onClick={() => handleEmployeeSelect(employee)}
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
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
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
        </div>

        {/* Start Date */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="start-date">From</label>
          <input
            id="start-date"
            type="date"
            className="form-control"
            value={dateRange.start}
            onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
          />
        </div>

        {/* End Date */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="end-date">To</label>
          <input
            id="end-date"
            type="date"
            className="form-control"
            value={dateRange.end}
            onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

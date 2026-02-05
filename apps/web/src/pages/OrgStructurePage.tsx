import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useTranslate } from '../hooks/useI18n';
import { getApiClient } from '../services/api-client';
import { queryKeys } from '../services/query-keys';

interface Manager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  managerIds?: string[];
  managers?: Manager[];
}

export function OrgStructurePage(): React.ReactElement {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);

  const employeesQuery = useQuery({
    queryKey: queryKeys.employees(),
    queryFn: async () => {
      const apiClient = await getApiClient();
      const response = await apiClient.get<{ data: Employee[] }>('/api/employees');
      return response.data;
    },
  });

  const updateManagerMutation = useMutation({
    mutationFn: async ({ employeeId, managerIds }: { employeeId: string; managerIds: string[] }) => {
      const apiClient = await getApiClient();
      return apiClient.put(`/api/employees/${employeeId}/managers`, {
        managerIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees() });
      setEditingUserId(null);
      setSelectedManagerIds([]);
    },
  });

  const handleSaveManager = (employeeId: string) => {
    updateManagerMutation.mutate({ employeeId, managerIds: selectedManagerIds });
  };

  if (employeesQuery.isLoading) {
    return <LoadingSkeleton lines={8} card />;
  }

  const employees = employeesQuery.data ?? [];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{t('orgStructure.title') || 'Organization Structure'}</h1>
        <p className="page-description">
          {t('orgStructure.description') || 'Manage reporting relationships and organizational hierarchy'}
        </p>
      </div>

      <div className="org-structure-container">
        <div className="org-structure-table">
          <table>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Email</th>
                <th>Reports To</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const managers = employee.managers ?? [];
                const isEditing = editingUserId === employee.id;

                return (
                  <tr key={employee.id} className={isEditing ? 'editing' : ''}>
                    <td>
                      <strong>{`${employee.firstName} ${employee.lastName}`}</strong>
                    </td>
                    <td>{employee.email}</td>
                    <td>
                      {isEditing ? (
                        <select
                          multiple
                          value={selectedManagerIds}
                          onChange={(e) => {
                            const values = Array.from(e.target.selectedOptions).map(
                              (option) => option.value
                            );
                            setSelectedManagerIds(values);
                          }}
                          className="manager-select"
                        >
                          {employees
                            .filter((e) => e.id !== employee.id)
                            .map((e) => (
                              <option key={e.id} value={e.id}>
                                {`${e.firstName} ${e.lastName}`}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <span>
                          {managers.length > 0
                            ? managers.map((m) => `${m.firstName} ${m.lastName}`).join(', ')
                            : 'Unassigned'}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="action-buttons">
                          <button
                            className="button primary"
                            onClick={() => handleSaveManager(employee.id)}
                            disabled={updateManagerMutation.isPending}
                          >
                            Save
                          </button>
                          <button
                            className="button secondary"
                            onClick={() => {
                              setEditingUserId(null);
                              setSelectedManagerIds([]);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="button secondary"
                            onClick={() => {
                              setEditingUserId(employee.id);
                            setSelectedManagerIds(employee.managerIds ?? []);
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

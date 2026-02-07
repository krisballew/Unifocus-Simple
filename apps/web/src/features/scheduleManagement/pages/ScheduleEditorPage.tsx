import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState, useMemo } from 'react';

import { LoadingSkeleton } from '../../../components/LoadingSkeleton';
import { useSelection } from '../../../context/SelectionContext';
import { useAuth } from '../../../hooks/useAuth';
import { getSchedulePeriods } from '../../../services/api-client';
import { hasPermission, SCHEDULING_PERMISSIONS } from '../../../utils/permissions';
import { getDepartments, getJobRoles } from '../api/lookups';
import {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  assignShift,
  unassignShift,
} from '../api/shifts';
import type { Shift, CreateShiftPayload, UpdateShiftPayload } from '../api/shifts';
import { AssignEmployeesModal } from '../components/AssignEmployeesModal';
import { BulkCreateShiftsModal } from '../components/BulkCreateShiftsModal';
import type { BulkCreateFormData } from '../components/BulkCreateShiftsModal';
import { CopyDayModal } from '../components/CopyDayModal';
import type { CopyDayOptions } from '../components/CopyDayModal';
import { ShiftList } from '../components/ShiftList';
import { ShiftModal } from '../components/ShiftModal';
import type { ShiftFormData } from '../components/ShiftModal';

export function ScheduleEditorPage(): React.ReactElement {
  const { selectedTenantId, selectedPropertyId } = useSelection();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Permission checks
  const canView = hasPermission(user, SCHEDULING_PERMISSIONS.VIEW);
  const canEdit = hasPermission(user, SCHEDULING_PERMISSIONS.EDIT_SHIFTS);
  const canAssign = hasPermission(user, SCHEDULING_PERMISSIONS.ASSIGN);

  // State
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [jobRoleFilter, setJobRoleFilter] = useState<string>('');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [showCopyDayModal, setShowCopyDayModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | undefined>(undefined);
  const [assigningShift, setAssigningShift] = useState<Shift | undefined>(undefined);
  const [bulkCreateProgress, setBulkCreateProgress] = useState<{
    current: number;
    total: number;
    errors: string[];
  } | null>(null);
  const [copyDayProgress, setCopyDayProgress] = useState<{
    current: number;
    total: number;
    errors: string[];
  } | null>(null);

  // Fetch schedule periods
  const periodsQuery = useQuery({
    queryKey: ['schedulePeriods', selectedPropertyId ?? 'all'],
    queryFn: () =>
      getSchedulePeriods({
        propertyId: selectedPropertyId!,
      }),
    enabled: Boolean(selectedTenantId && selectedPropertyId && canView),
  });

  // Fetch departments for filter
  const departmentsQuery = useQuery({
    queryKey: ['departments', selectedPropertyId],
    queryFn: () => getDepartments({ propertyId: selectedPropertyId! }),
    enabled: Boolean(selectedPropertyId && canView),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch job roles for filter, optionally filtered by department
  const jobRolesQuery = useQuery({
    queryKey: ['jobRoles', selectedPropertyId, departmentFilter],
    queryFn: () =>
      getJobRoles({ propertyId: selectedPropertyId!, departmentId: departmentFilter || undefined }),
    enabled: Boolean(selectedPropertyId && canView),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Auto-select most recent DRAFT period, or latest period
  useMemo(() => {
    if (periodsQuery.data && periodsQuery.data.length > 0 && !selectedPeriodId) {
      const draftPeriods = periodsQuery.data.filter((p) => p.status === 'DRAFT');
      const defaultPeriod = draftPeriods.length > 0 ? draftPeriods[0] : periodsQuery.data[0];
      setSelectedPeriodId(defaultPeriod.id);

      // Set default date to start of period
      const startDate = new Date(defaultPeriod.startDate);
      const isoDate = startDate.toISOString().split('T')[0];
      setSelectedDate(isoDate);
    }
  }, [periodsQuery.data, selectedPeriodId]);

  const selectedPeriod = periodsQuery.data?.find((p) => p.id === selectedPeriodId);

  // Get days in selected period
  const periodDays = useMemo(() => {
    if (!selectedPeriod) return [];

    const start = new Date(selectedPeriod.startDate);
    const end = new Date(selectedPeriod.endDate);
    const days: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }

    return days;
  }, [selectedPeriod]);

  // Fetch shifts for selected period and date
  const shiftsQuery = useQuery({
    queryKey: [
      'shifts',
      selectedPeriodId,
      selectedDate,
      departmentFilter,
      jobRoleFilter,
      selectedPropertyId,
    ],
    queryFn: () => {
      if (!selectedDate) return [];

      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      return getShifts({
        propertyId: selectedPropertyId!,
        schedulePeriodId: selectedPeriodId,
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString(),
        ...(departmentFilter && { departmentId: departmentFilter }),
        ...(jobRoleFilter && { jobRoleId: jobRoleFilter }),
      });
    },
    enabled: Boolean(selectedPropertyId && selectedPeriodId && selectedDate && canView),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateShiftPayload) => createShift(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setShowShiftModal(false);
      setEditingShift(undefined);
    },
    onError: (error) => {
      alert(`Failed to create shift: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ shiftId, payload }: { shiftId: string; payload: UpdateShiftPayload }) =>
      updateShift(shiftId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setShowShiftModal(false);
      setEditingShift(undefined);
    },
    onError: (error) => {
      alert(`Failed to update shift: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (shiftId: string) => deleteShift(shiftId, { propertyId: selectedPropertyId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (error) => {
      alert(`Failed to delete shift: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ shiftId, employeeId }: { shiftId: string; employeeId: string }) =>
      assignShift(shiftId, { propertyId: selectedPropertyId!, employeeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (error) => {
      alert(
        `Failed to assign employee: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    },
  });

  const unassignMutation = useMutation({
    mutationFn: ({ shiftId, employeeId }: { shiftId: string; employeeId: string }) =>
      unassignShift(shiftId, { propertyId: selectedPropertyId!, employeeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (error) => {
      alert(
        `Failed to unassign employee: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    },
  });

  const toggleOpenMutation = useMutation({
    mutationFn: ({ shiftId, isOpenShift }: { shiftId: string; isOpenShift: boolean }) =>
      updateShift(shiftId, { propertyId: selectedPropertyId!, isOpenShift }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (error) => {
      alert(
        `Failed to toggle shift status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    },
  });

  // Handlers
  const handleCreateShift = () => {
    setEditingShift(undefined);
    setShowShiftModal(true);
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShowShiftModal(true);
  };

  const handleSaveShift = (formData: ShiftFormData) => {
    if (!selectedPropertyId || !selectedPeriodId || !selectedDate) return;

    // Combine date with times to create ISO datetime strings
    const startDateTime = new Date(`${selectedDate}T${formData.startTime}:00`).toISOString();
    const endDateTime = new Date(`${selectedDate}T${formData.endTime}:00`).toISOString();

    if (editingShift) {
      // Update existing shift
      updateMutation.mutate({
        shiftId: editingShift.id,
        payload: {
          propertyId: selectedPropertyId,
          departmentId: formData.departmentId,
          jobRoleId: formData.jobRoleId,
          startDateTime,
          endDateTime,
          breakMinutes: formData.breakMinutes,
          isOpenShift: formData.isOpenShift,
          notes: formData.notes,
        },
      });
    } else {
      // Create new shift
      createMutation.mutate({
        schedulePeriodId: selectedPeriodId,
        propertyId: selectedPropertyId,
        departmentId: formData.departmentId,
        jobRoleId: formData.jobRoleId,
        startDateTime,
        endDateTime,
        breakMinutes: formData.breakMinutes,
        isOpenShift: formData.isOpenShift,
        notes: formData.notes,
      });
    }
  };

  const handleDeleteShift = (shiftId: string) => {
    deleteMutation.mutate(shiftId);
  };

  const handleAssignClick = (shift: Shift) => {
    setAssigningShift(shift);
    setShowAssignModal(true);
  };

  const handleAssign = (employeeId: string) => {
    if (!assigningShift) return;
    assignMutation.mutate({ shiftId: assigningShift.id, employeeId });
  };

  const handleUnassign = (employeeId: string) => {
    if (!assigningShift) return;
    unassignMutation.mutate({ shiftId: assigningShift.id, employeeId });
  };

  const handleToggleOpen = (shift: Shift) => {
    toggleOpenMutation.mutate({ shiftId: shift.id, isOpenShift: !shift.isOpenShift });
  };

  const handleBulkCreate = async (
    templates: { startTime: string; endTime: string; count: number }[],
    formData: BulkCreateFormData
  ) => {
    if (!selectedPropertyId || !selectedPeriodId || !selectedDate) return;

    const totalShifts = templates.reduce((sum, t) => sum + t.count, 0);
    setBulkCreateProgress({ current: 0, total: totalShifts, errors: [] });

    let current = 0;
    const errors: string[] = [];

    // Process templates in batches of 3 for controlled concurrency
    const batchSize = 3;
    const allShifts: Array<{ template: (typeof templates)[0]; index: number }> = [];

    templates.forEach((template) => {
      for (let i = 0; i < template.count; i++) {
        allShifts.push({ template, index: i });
      }
    });

    for (let i = 0; i < allShifts.length; i += batchSize) {
      const batch = allShifts.slice(i, i + batchSize);
      const promises = batch.map(async ({ template }) => {
        try {
          const startDateTime = new Date(`${selectedDate}T${template.startTime}:00`).toISOString();
          const endDateTime = new Date(`${selectedDate}T${template.endTime}:00`).toISOString();

          await createShift({
            schedulePeriodId: selectedPeriodId,
            propertyId: selectedPropertyId,
            departmentId: formData.departmentId,
            jobRoleId: formData.jobRoleId,
            startDateTime,
            endDateTime,
            breakMinutes: formData.breakMinutes,
            isOpenShift: formData.isOpenShift,
            notes: formData.notes || undefined,
          });
          current++;
          setBulkCreateProgress({ current, total: totalShifts, errors });
        } catch (error) {
          const errorMsg = `Failed to create shift ${template.startTime}-${template.endTime}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          setBulkCreateProgress({ current, total: totalShifts, errors });
        }
      });

      await Promise.all(promises);
    }

    // Refresh shifts list
    await queryClient.invalidateQueries({ queryKey: ['shifts'] });

    // Show summary
    if (errors.length > 0) {
      alert(
        `Created ${current} of ${totalShifts} shifts.\n\nErrors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more` : ''}`
      );
    } else {
      alert(`Successfully created all ${totalShifts} shifts!`);
    }

    setBulkCreateProgress(null);
    setShowBulkCreateModal(false);
  };

  const handleCopyDay = async (sourceDate: string, targetDate: string, options: CopyDayOptions) => {
    if (!selectedPropertyId || !selectedPeriodId) return;

    try {
      // Fetch shifts from source date
      const startOfDay = new Date(sourceDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(sourceDate);
      endOfDay.setHours(23, 59, 59, 999);

      const sourceShifts = await getShifts({
        propertyId: selectedPropertyId,
        schedulePeriodId: selectedPeriodId,
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString(),
      });

      if (sourceShifts.length === 0) {
        alert('No shifts found on the source date.');
        setCopyDayProgress(null);
        setShowCopyDayModal(false);
        return;
      }

      setCopyDayProgress({ current: 0, total: sourceShifts.length, errors: [] });

      let current = 0;
      const errors: string[] = [];
      const createdShifts: Shift[] = [];

      // Process shifts in batches of 3
      const batchSize = 3;
      for (let i = 0; i < sourceShifts.length; i += batchSize) {
        const batch = sourceShifts.slice(i, i + batchSize);
        const promises = batch.map(async (sourceShift) => {
          try {
            // Calculate time offset
            const sourceStart = new Date(sourceShift.startDateTime);
            const sourceEnd = new Date(sourceShift.endDateTime);
            const startTime = sourceStart.toTimeString().slice(0, 5);
            const endTime = sourceEnd.toTimeString().slice(0, 5);

            const targetStartDateTime = new Date(`${targetDate}T${startTime}:00`).toISOString();
            const targetEndDateTime = new Date(`${targetDate}T${endTime}:00`).toISOString();

            const newShift = await createShift({
              schedulePeriodId: selectedPeriodId,
              propertyId: selectedPropertyId,
              departmentId: sourceShift.departmentId,
              jobRoleId: sourceShift.jobRoleId,
              startDateTime: targetStartDateTime,
              endDateTime: targetEndDateTime,
              breakMinutes: sourceShift.breakMinutes,
              isOpenShift: options.setAsOpenShifts ? true : sourceShift.isOpenShift,
              notes: sourceShift.notes || undefined,
            });

            createdShifts.push(newShift);
            current++;
            setCopyDayProgress({ current, total: sourceShifts.length, errors });

            // If including assignments and shift has assignments, copy them
            if (options.includeAssignments && sourceShift.assignments && !options.setAsOpenShifts) {
              for (const assignment of sourceShift.assignments) {
                try {
                  await assignShift(newShift.id, {
                    propertyId: selectedPropertyId,
                    employeeId: assignment.employeeId,
                  });
                } catch (assignError) {
                  errors.push(
                    `Failed to assign employee to shift: ${assignError instanceof Error ? assignError.message : 'Unknown error'}`
                  );
                }
              }
            }
          } catch (error) {
            errors.push(
              `Failed to copy shift: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            setCopyDayProgress({ current, total: sourceShifts.length, errors });
          }
        });

        await Promise.all(promises);
      }

      // Refresh shifts list
      await queryClient.invalidateQueries({ queryKey: ['shifts'] });

      // Show summary
      if (errors.length > 0) {
        alert(
          `Copied ${current} of ${sourceShifts.length} shifts.\n\nErrors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more` : ''}`
        );
      } else {
        alert(`Successfully copied all ${sourceShifts.length} shifts!`);
      }

      setCopyDayProgress(null);
      setShowCopyDayModal(false);
    } catch (error) {
      alert(
        `Failed to fetch source shifts: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setCopyDayProgress(null);
      setShowCopyDayModal(false);
    }
  };

  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    assignMutation.isPending ||
    unassignMutation.isPending ||
    toggleOpenMutation.isPending;

  // Authorization check
  if (!canView) {
    return (
      <div className="placeholder">
        <h2>Schedule Editor</h2>
        <p>You don't have permission to access the Schedule Editor.</p>
        <p>Required permission: scheduling.view</p>
      </div>
    );
  }

  if (!selectedPropertyId) {
    return (
      <div className="placeholder">
        <h2>Schedule Editor</h2>
        <p>Please select a property to view and edit schedules.</p>
      </div>
    );
  }

  if (periodsQuery.isLoading) {
    return <LoadingSkeleton lines={10} card />;
  }

  if (periodsQuery.isError) {
    return (
      <div className="placeholder">
        <h2>Schedule Editor</h2>
        <p>Failed to load schedule periods.</p>
      </div>
    );
  }

  const periods = periodsQuery.data ?? [];

  if (periods.length === 0) {
    return (
      <div className="placeholder">
        <h2>Schedule Editor</h2>
        <p>No schedule periods found. Create a period first in the Periods page.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Schedule Editor</h2>
          <p>Create and manage shift schedules.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setShowCopyDayModal(true)}
            disabled={isLoading || !canEdit || !selectedDate || !!copyDayProgress}
            title={
              !canEdit
                ? 'You do not have permission to copy shifts'
                : 'Copy shifts from another day'
            }
          >
            Copy Day
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setShowBulkCreateModal(true)}
            disabled={isLoading || !canEdit || !selectedDate || !!bulkCreateProgress}
            title={
              !canEdit
                ? 'You do not have permission to create shifts'
                : 'Create multiple shifts at once'
            }
          >
            Bulk Create
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={handleCreateShift}
            disabled={isLoading || !canEdit || !selectedDate}
            title={!canEdit ? 'You do not have permission to create shifts' : ''}
          >
            Create Shift
          </button>
        </div>
      </div>

      <div
        style={{
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <div
          className="form-group"
          style={{ flex: '1 1 200px', minWidth: '200px', marginBottom: 0 }}
        >
          <label htmlFor="period-selector">Schedule Period</label>
          <select
            id="period-selector"
            className="form-control"
            value={selectedPeriodId}
            onChange={(e) => {
              setSelectedPeriodId(e.target.value);
              // Reset date when period changes
              const period = periods.find((p) => p.id === e.target.value);
              if (period) {
                const startDate = new Date(period.startDate);
                setSelectedDate(startDate.toISOString().split('T')[0]);
              }
            }}
          >
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name ||
                  `${new Date(period.startDate).toLocaleDateString()} - ${new Date(period.endDate).toLocaleDateString()}`}{' '}
                ({period.status})
              </option>
            ))}
          </select>
        </div>

        {canView && (
          <>
            <div
              className="form-group"
              style={{ flex: '1 1 200px', minWidth: '200px', marginBottom: 0 }}
            >
              <label htmlFor="department-filter">Department</label>
              <select
                id="department-filter"
                className="form-control"
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  // Clear job role filter when department changes
                  setJobRoleFilter('');
                }}
              >
                <option value="">All Departments</option>
                {departmentsQuery.isLoading && <option disabled>Loading...</option>}
                {departmentsQuery.data?.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="form-group"
              style={{ flex: '1 1 200px', minWidth: '200px', marginBottom: 0 }}
            >
              <label htmlFor="job-role-filter">Job Role</label>
              <select
                id="job-role-filter"
                className="form-control"
                value={jobRoleFilter}
                onChange={(e) => setJobRoleFilter(e.target.value)}
              >
                <option value="">All Job Roles</option>
                {jobRolesQuery.isLoading && <option disabled>Loading...</option>}
                {jobRolesQuery.data?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {selectedPeriod && periodDays.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {periodDays.map((day) => {
              const date = new Date(day);
              const isSelected = day === selectedDate;
              return (
                <button
                  key={day}
                  type="button"
                  className={`button ${isSelected ? 'button--primary' : 'button--secondary'}`}
                  onClick={() => setSelectedDate(day)}
                  style={{ minWidth: '120px' }}
                >
                  {date.toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {shiftsQuery.isLoading ? (
        <LoadingSkeleton lines={5} card />
      ) : shiftsQuery.isError ? (
        <div className="placeholder">
          <p>Failed to load shifts.</p>
        </div>
      ) : (
        <ShiftList
          shifts={shiftsQuery.data ?? []}
          propertyId={selectedPropertyId!}
          onEdit={handleEditShift}
          onDelete={handleDeleteShift}
          onAssign={handleAssignClick}
          onToggleOpen={handleToggleOpen}
          isLoading={isLoading}
          canEdit={canEdit}
          canAssign={canAssign}
        />
      )}

      {showShiftModal && selectedPropertyId && selectedPeriodId && selectedDate && (
        <ShiftModal
          shift={editingShift}
          selectedDate={selectedDate}
          propertyId={selectedPropertyId}
          schedulePeriodId={selectedPeriodId}
          onClose={() => {
            setShowShiftModal(false);
            setEditingShift(undefined);
          }}
          onSave={handleSaveShift}
          isLoading={isLoading}
        />
      )}

      {showAssignModal && assigningShift && (
        <AssignEmployeesModal
          shift={assigningShift}
          onClose={() => {
            setShowAssignModal(false);
            setAssigningShift(undefined);
          }}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          isLoading={isLoading}
        />
      )}

      {showBulkCreateModal && selectedPropertyId && selectedPeriodId && selectedDate && (
        <BulkCreateShiftsModal
          propertyId={selectedPropertyId}
          schedulePeriodId={selectedPeriodId}
          selectedDate={selectedDate}
          onClose={() => {
            if (!bulkCreateProgress) {
              setShowBulkCreateModal(false);
            }
          }}
          onSubmit={handleBulkCreate}
          isLoading={!!bulkCreateProgress}
        />
      )}

      {showCopyDayModal && periodDays.length > 0 && selectedDate && (
        <CopyDayModal
          periodDays={periodDays}
          selectedDate={selectedDate}
          onClose={() => {
            if (!copyDayProgress) {
              setShowCopyDayModal(false);
            }
          }}
          onSubmit={handleCopyDay}
          isLoading={!!copyDayProgress}
          canAssign={canAssign}
        />
      )}

      {/* Progress indicators */}
      {bulkCreateProgress && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'white',
            border: '2px solid var(--brand-primary)',
            borderRadius: '8px',
            padding: '1rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '300px',
            zIndex: 1000,
          }}
        >
          <strong>Bulk Creating Shifts</strong>
          <div style={{ marginTop: '0.5rem' }}>
            Progress: {bulkCreateProgress.current} / {bulkCreateProgress.total}
          </div>
          {bulkCreateProgress.errors.length > 0 && (
            <div style={{ marginTop: '0.5rem', color: 'red', fontSize: '0.875rem' }}>
              {bulkCreateProgress.errors.length} error(s) occurred
            </div>
          )}
        </div>
      )}

      {copyDayProgress && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'white',
            border: '2px solid var(--brand-primary)',
            borderRadius: '8px',
            padding: '1rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '300px',
            zIndex: 1000,
          }}
        >
          <strong>Copying Day Shifts</strong>
          <div style={{ marginTop: '0.5rem' }}>
            Progress: {copyDayProgress.current} / {copyDayProgress.total}
          </div>
          {copyDayProgress.errors.length > 0 && (
            <div style={{ marginTop: '0.5rem', color: 'red', fontSize: '0.875rem' }}>
              {copyDayProgress.errors.length} error(s) occurred
            </div>
          )}
        </div>
      )}
    </div>
  );
}

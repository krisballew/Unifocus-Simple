import React, { useMemo } from 'react';

import type { Shift } from '../api/shifts';
import { useScheduleLookups } from '../hooks/useScheduleLookups';

export interface ShiftListProps {
  shifts: Shift[];
  propertyId: string;
  onEdit: (shift: Shift) => void;
  onDelete: (shiftId: string) => void;
  onAssign: (shift: Shift) => void;
  onToggleOpen: (shift: Shift) => void;
  isLoading?: boolean;
  canEdit?: boolean;
  canAssign?: boolean;
}

export function ShiftList({
  shifts,
  propertyId,
  onEdit,
  onDelete,
  onAssign,
  onToggleOpen,
  isLoading = false,
  canEdit = false,
  canAssign = false,
}: ShiftListProps): React.ReactElement {
  // Fetch lookups for resolving IDs to names
  const lookups = useScheduleLookups(propertyId);

  const roleColors = [
    'var(--uf-pistachio-70)',
    'var(--uf-cyan-70)',
    'var(--uf-sky-60)',
    'var(--uf-warning-60)',
    'var(--uf-teal-60)',
  ];

  const getRoleColor = (value?: string): string => {
    if (!value) return roleColors[0];
    const hash = Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return roleColors[hash % roleColors.length];
  };
  const formatTime = (dateTimeStr: string): string => {
    const date = new Date(dateTimeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeRange = (shift: Shift): string => {
    return `${formatTime(shift.startDateTime)} - ${formatTime(shift.endDateTime)}`;
  };

  const getAssignedCount = (shift: Shift): string => {
    const count = shift.assignments?.length || 0;
    if (count === 0) return 'Unassigned';
    return `${count} assigned`;
  };

  const getDepartmentName = (shift: Shift): string => {
    // Use looked up data first, then nested data, then ID
    if (lookups.departmentsById[shift.departmentId]) {
      return lookups.departmentsById[shift.departmentId].name;
    }
    return shift.department?.name || shift.departmentId;
  };

  const getJobRoleName = (shift: Shift): string => {
    // Use looked up data first, then nested data, then ID
    if (lookups.jobRolesById[shift.jobRoleId]) {
      return lookups.jobRolesById[shift.jobRoleId].name;
    }
    return shift.jobRole?.name || shift.jobRoleId;
  };

  const { groupedRoles, openShifts } = useMemo(() => {
    const grouped = new Map<string, Shift[]>();
    const open = shifts.filter((shift) => shift.isOpenShift);
    const assigned = shifts.filter((shift) => !shift.isOpenShift);

    assigned.forEach((shift) => {
      const roleKey = shift.jobRoleId || 'unknown-role';
      if (!grouped.has(roleKey)) {
        grouped.set(roleKey, []);
      }
      grouped.get(roleKey)?.push(shift);
    });

    const groupedArray = Array.from(grouped.entries()).map(([roleId, roleShifts]) => ({
      roleId,
      shifts: roleShifts,
    }));

    return { groupedRoles: groupedArray, openShifts: open };
  }, [shifts]);

  const getRoleHeaderStyle = (roleId: string): React.CSSProperties => ({
    ['--role-color' as string]: getRoleColor(roleId),
  });

  if (shifts.length === 0) {
    return (
      <div className="placeholder">
        <p>No shifts found for the selected period and filters.</p>
      </div>
    );
  }

  return (
    <div className="schedule-grid">
      {openShifts.length > 0 && (
        <div className="schedule-section">
          <div className="schedule-section__header">
            <span className="schedule-section__title">Open shifts</span>
            <span className="schedule-section__meta">{openShifts.length} total</span>
          </div>
          <div className="schedule-section__body">
            {openShifts.map((shift) => (
              <div className="schedule-shift-row" key={shift.id}>
                <div className="schedule-shift-card">
                  <div className="schedule-shift-time">{getTimeRange(shift)}</div>
                  <div className="schedule-shift-meta">
                    <span>{getDepartmentName(shift)}</span>
                    <span className="schedule-shift-dot">•</span>
                    <span>{getJobRoleName(shift)}</span>
                    <span className="schedule-shift-dot">•</span>
                    <span>{shift.breakMinutes || 0} min break</span>
                  </div>
                </div>
                <div className="schedule-shift-status">
                  <span className="badge badge--draft">Open</span>
                </div>
                <div className="schedule-shift-actions">
                  {canAssign && (
                    <button
                      type="button"
                      className="button button--small"
                      onClick={() => onAssign(shift)}
                      disabled={isLoading}
                      title="Manage assignments"
                    >
                      Assign
                    </button>
                  )}
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="button button--small"
                        onClick={() => onToggleOpen(shift)}
                        disabled={isLoading}
                        title="Mark as assigned shift"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        className="button button--small"
                        onClick={() => onEdit(shift)}
                        disabled={isLoading}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button button--small button--danger"
                        onClick={() => {
                          if (window.confirm('Delete this shift?')) {
                            onDelete(shift.id);
                          }
                        }}
                        disabled={isLoading}
                        title="Delete shift"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {groupedRoles.map(({ roleId, shifts: roleShifts }) => (
        <div className="schedule-section" key={roleId}>
          <div className="schedule-role-header" style={getRoleHeaderStyle(roleId)}>
            <span className="schedule-role-dot" />
            <span className="schedule-role-title">{getJobRoleName(roleShifts[0])}</span>
            <span className="schedule-role-meta">{roleShifts.length} shifts</span>
          </div>
          <div className="schedule-section__body">
            {roleShifts.map((shift) => (
              <div className="schedule-shift-row" key={shift.id}>
                <div className="schedule-shift-card">
                  <div className="schedule-shift-time">{getTimeRange(shift)}</div>
                  <div className="schedule-shift-meta">
                    <span>{getDepartmentName(shift)}</span>
                    <span className="schedule-shift-dot">•</span>
                    <span>{getAssignedCount(shift)}</span>
                    <span className="schedule-shift-dot">•</span>
                    <span>{shift.breakMinutes || 0} min break</span>
                  </div>
                </div>
                <div className="schedule-shift-status">
                  {shift.isOpenShift ? (
                    <span className="badge badge--draft">Open</span>
                  ) : (
                    <span className="badge badge--published">Assigned</span>
                  )}
                </div>
                <div className="schedule-shift-actions">
                  {canAssign && (
                    <button
                      type="button"
                      className="button button--small"
                      onClick={() => onAssign(shift)}
                      disabled={isLoading}
                      title="Manage assignments"
                    >
                      Assign
                    </button>
                  )}
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="button button--small"
                        onClick={() => onToggleOpen(shift)}
                        disabled={isLoading}
                        title={shift.isOpenShift ? 'Mark as assigned shift' : 'Mark as open shift'}
                      >
                        {shift.isOpenShift ? 'Close' : 'Open'}
                      </button>
                      <button
                        type="button"
                        className="button button--small"
                        onClick={() => onEdit(shift)}
                        disabled={isLoading}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button button--small button--danger"
                        onClick={() => {
                          if (window.confirm('Delete this shift?')) {
                            onDelete(shift.id);
                          }
                        }}
                        disabled={isLoading}
                        title="Delete shift"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

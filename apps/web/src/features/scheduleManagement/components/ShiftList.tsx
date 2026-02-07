import React from 'react';

import type { Shift } from '../api/shifts';

export interface ShiftListProps {
  shifts: Shift[];
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
  onEdit,
  onDelete,
  onAssign,
  onToggleOpen,
  isLoading = false,
  canEdit = false,
  canAssign = false,
}: ShiftListProps): React.ReactElement {
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

  if (shifts.length === 0) {
    return (
      <div className="placeholder">
        <p>No shifts found for the selected period and filters.</p>
      </div>
    );
  }

  return (
    <div className="page-table">
      <div className="page-table__row page-table__header">
        <div>Time</div>
        <div>Department</div>
        <div>Job Role</div>
        <div>Assigned</div>
        <div>Break</div>
        <div>Status</div>
        <div>Actions</div>
      </div>
      {shifts.map((shift) => (
        <div className="page-table__row" key={shift.id}>
          <div>{getTimeRange(shift)}</div>
          <div>{shift.department?.name || shift.departmentId}</div>
          <div>{shift.jobRole?.name || shift.jobRoleId}</div>
          <div>{getAssignedCount(shift)}</div>
          <div>{shift.breakMinutes || 0} min</div>
          <div>
            {shift.isOpenShift ? (
              <span className="badge badge--draft">Open</span>
            ) : (
              <span className="badge badge--published">Assigned</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
  );
}

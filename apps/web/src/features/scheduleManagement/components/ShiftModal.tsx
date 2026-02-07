import React, { useState } from 'react';

import type { Shift } from '../api/shifts';

export interface ShiftModalProps {
  shift?: Shift;
  selectedDate: string; // ISO date string (YYYY-MM-DD)
  propertyId: string;
  schedulePeriodId: string;
  onClose: () => void;
  onSave: (data: ShiftFormData) => void;
  isLoading?: boolean;
}

export interface ShiftFormData {
  departmentId: string;
  jobRoleId: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  breakMinutes: number;
  isOpenShift: boolean;
  notes?: string;
}

export function ShiftModal({
  shift,
  selectedDate,
  propertyId: _propertyId,
  schedulePeriodId: _schedulePeriodId,
  onClose,
  onSave,
  isLoading = false,
}: ShiftModalProps): React.ReactElement {
  const isEditMode = Boolean(shift);

  // Extract time from ISO datetime string
  const extractTime = (dateTimeStr: string): string => {
    const date = new Date(dateTimeStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState<ShiftFormData>({
    departmentId: shift?.departmentId || '',
    jobRoleId: shift?.jobRoleId || '',
    startTime: shift ? extractTime(shift.startDateTime) : '09:00',
    endTime: shift ? extractTime(shift.endDateTime) : '17:00',
    breakMinutes: shift?.breakMinutes || 0,
    isOpenShift: shift?.isOpenShift || false,
    notes: shift?.notes || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.departmentId.trim()) {
      newErrors.departmentId = 'Department is required';
    }

    if (!formData.jobRoleId.trim()) {
      newErrors.jobRoleId = 'Job role is required';
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }

    // Validate time ordering
    if (formData.startTime && formData.endTime) {
      const [startHour, startMin] = formData.startTime.split(':').map(Number);
      const [endHour, endMin] = formData.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (endMinutes <= startMinutes) {
        newErrors.endTime = 'End time must be after start time';
      }
    }

    if (formData.breakMinutes < 0) {
      newErrors.breakMinutes = 'Break minutes cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSave(formData);
  };

  const handleChange = (field: keyof ShiftFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Shift' : 'Create Shift'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="shift-date">
                Date <span className="text-required">*</span>
              </label>
              <input
                id="shift-date"
                type="date"
                className="form-control"
                value={selectedDate}
                disabled
              />
              <small className="text-muted">Date is locked to the selected day</small>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="start-time">
                  Start Time <span className="text-required">*</span>
                </label>
                <input
                  id="start-time"
                  type="time"
                  className={`form-control ${errors.startTime ? 'error' : ''}`}
                  value={formData.startTime}
                  onChange={(e) => handleChange('startTime', e.target.value)}
                  disabled={isLoading}
                  required
                />
                {errors.startTime && <small className="error-text">{errors.startTime}</small>}
              </div>

              <div className="form-group">
                <label htmlFor="end-time">
                  End Time <span className="text-required">*</span>
                </label>
                <input
                  id="end-time"
                  type="time"
                  className={`form-control ${errors.endTime ? 'error' : ''}`}
                  value={formData.endTime}
                  onChange={(e) => handleChange('endTime', e.target.value)}
                  disabled={isLoading}
                  required
                />
                {errors.endTime && <small className="error-text">{errors.endTime}</small>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="department-id">
                Department ID <span className="text-required">*</span>
              </label>
              <input
                id="department-id"
                type="text"
                className={`form-control ${errors.departmentId ? 'error' : ''}`}
                value={formData.departmentId}
                onChange={(e) => handleChange('departmentId', e.target.value)}
                placeholder="Enter department ID"
                disabled={isLoading}
                required
              />
              {errors.departmentId && <small className="error-text">{errors.departmentId}</small>}
              <small className="text-muted">TODO: Replace with department selector</small>
            </div>

            <div className="form-group">
              <label htmlFor="job-role-id">
                Job Role ID <span className="text-required">*</span>
              </label>
              <input
                id="job-role-id"
                type="text"
                className={`form-control ${errors.jobRoleId ? 'error' : ''}`}
                value={formData.jobRoleId}
                onChange={(e) => handleChange('jobRoleId', e.target.value)}
                placeholder="Enter job role ID"
                disabled={isLoading}
                required
              />
              {errors.jobRoleId && <small className="error-text">{errors.jobRoleId}</small>}
              <small className="text-muted">TODO: Replace with job role selector</small>
            </div>

            <div className="form-group">
              <label htmlFor="break-minutes">Break Minutes</label>
              <input
                id="break-minutes"
                type="number"
                className={`form-control ${errors.breakMinutes ? 'error' : ''}`}
                value={formData.breakMinutes}
                onChange={(e) => handleChange('breakMinutes', parseInt(e.target.value, 10) || 0)}
                min="0"
                max="480"
                disabled={isLoading}
              />
              {errors.breakMinutes && <small className="error-text">{errors.breakMinutes}</small>}
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.isOpenShift}
                  onChange={(e) => handleChange('isOpenShift', e.target.checked)}
                  disabled={isLoading}
                />
                <span style={{ marginLeft: '0.5rem' }}>
                  Open Shift (available for employees to claim)
                </span>
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                className="form-control"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
                placeholder="Optional notes about this shift"
                disabled={isLoading}
                maxLength={1000}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button type="submit" className="button button--primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';

import { getDepartments, getJobRoles } from '../api/lookups';

interface ShiftTemplate {
  startTime: string;
  endTime: string;
  count: number;
}

interface BulkCreateShiftsModalProps {
  propertyId: string;
  schedulePeriodId: string;
  selectedDate: string;
  onClose: () => void;
  onSubmit: (templates: ShiftTemplate[], formData: BulkCreateFormData) => void;
  isLoading: boolean;
}

export interface BulkCreateFormData {
  departmentId: string;
  jobRoleId: string;
  breakMinutes: number;
  notes: string;
  isOpenShift: boolean;
}

export function BulkCreateShiftsModal({
  propertyId,
  schedulePeriodId: _schedulePeriodId,
  selectedDate,
  onClose,
  onSubmit,
  isLoading,
}: BulkCreateShiftsModalProps): React.ReactElement {
  const [targetDate, setTargetDate] = useState(selectedDate);
  const [departmentId, setDepartmentId] = useState('');
  const [jobRoleId, setJobRoleId] = useState('');
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [notes, setNotes] = useState('');
  const [isOpenShift, setIsOpenShift] = useState(false);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([
    { startTime: '09:00', endTime: '17:00', count: 1 },
  ]);
  const [errors, setErrors] = useState<Record<number, string>>({});

  // Fetch departments
  const departmentsQuery = useQuery({
    queryKey: ['departments', propertyId],
    queryFn: () => getDepartments({ propertyId }),
    enabled: Boolean(propertyId),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch job roles filtered by department
  const jobRolesQuery = useQuery({
    queryKey: ['jobRoles', propertyId, departmentId],
    queryFn: () => getJobRoles({ propertyId, departmentId: departmentId || undefined }),
    enabled: Boolean(propertyId),
    staleTime: 5 * 60 * 1000,
  });

  const handleAddTemplate = () => {
    setTemplates([...templates, { startTime: '09:00', endTime: '17:00', count: 1 }]);
  };

  const handleRemoveTemplate = (index: number) => {
    setTemplates(templates.filter((_, i) => i !== index));
    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  };

  const handleTemplateChange = (
    index: number,
    field: keyof ShiftTemplate,
    value: string | number
  ) => {
    const newTemplates = [...templates];
    newTemplates[index] = { ...newTemplates[index], [field]: value };
    setTemplates(newTemplates);
  };

  const validateTemplates = (): boolean => {
    const newErrors: Record<number, string> = {};
    let isValid = true;

    templates.forEach((template, index) => {
      if (template.startTime >= template.endTime) {
        newErrors[index] = 'End time must be after start time';
        isValid = false;
      } else if (template.count < 1) {
        newErrors[index] = 'Count must be at least 1';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!departmentId || !jobRoleId) {
      alert('Please select a department and job role');
      return;
    }

    if (!validateTemplates()) {
      return;
    }

    const formData: BulkCreateFormData = {
      departmentId,
      jobRoleId,
      breakMinutes,
      notes,
      isOpenShift,
    };

    onSubmit(templates, formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <h3>Bulk Create Shifts</h3>
          <button type="button" className="modal-close" onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="target-date">Target Date</label>
              <input
                type="date"
                id="target-date"
                className="form-control"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="department-id">
                Department <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                id="department-id"
                className="form-control"
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setJobRoleId('');
                }}
                required
                disabled={isLoading}
              >
                <option value="">Select Department</option>
                {departmentsQuery.data?.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="job-role-id">
                Job Role <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                id="job-role-id"
                className="form-control"
                value={jobRoleId}
                onChange={(e) => setJobRoleId(e.target.value)}
                required
                disabled={isLoading || !departmentId}
              >
                <option value="">Select Job Role</option>
                {jobRolesQuery.data?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="break-minutes">Break Minutes</label>
              <input
                type="number"
                id="break-minutes"
                className="form-control"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
                min={0}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes (Optional)</label>
              <textarea
                id="notes"
                className="form-control"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={isOpenShift}
                  onChange={(e) => setIsOpenShift(e.target.checked)}
                  disabled={isLoading}
                  style={{ marginRight: '8px' }}
                />
                Open Shift (no employee assigned)
              </label>
            </div>

            <hr />

            <div style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <strong>Shift Templates</strong>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={handleAddTemplate}
                  disabled={isLoading}
                >
                  + Add Template
                </button>
              </div>

              {templates.map((template, index) => (
                <div
                  key={index}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '0.75rem',
                    background: errors[index] ? 'rgba(220, 53, 69, 0.05)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label htmlFor={`start-time-${index}`}>Start Time</label>
                      <input
                        type="time"
                        id={`start-time-${index}`}
                        className="form-control"
                        value={template.startTime}
                        onChange={(e) => handleTemplateChange(index, 'startTime', e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label htmlFor={`end-time-${index}`}>End Time</label>
                      <input
                        type="time"
                        id={`end-time-${index}`}
                        className="form-control"
                        value={template.endTime}
                        onChange={(e) => handleTemplateChange(index, 'endTime', e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="form-group" style={{ flex: '0 0 80px', marginBottom: 0 }}>
                      <label htmlFor={`count-${index}`}>Count</label>
                      <input
                        type="number"
                        id={`count-${index}`}
                        className="form-control"
                        value={template.count}
                        onChange={(e) =>
                          handleTemplateChange(index, 'count', Number(e.target.value))
                        }
                        min={1}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    {templates.length > 1 && (
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => handleRemoveTemplate(index)}
                        disabled={isLoading}
                        style={{ marginTop: '1.75rem' }}
                        title="Remove template"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {errors[index] && (
                    <div style={{ color: 'red', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      {errors[index]}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.875rem', color: 'var(--brand-muted)' }}>
              Total shifts to create:{' '}
              <strong>{templates.reduce((sum, t) => sum + t.count, 0)}</strong>
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
              {isLoading ? 'Creating...' : 'Create Shifts'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

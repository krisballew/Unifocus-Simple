import React, { useState } from 'react';

interface JobEditFormProps {
  jobs: Array<{
    id?: string;
    jobTitle: string;
    department: string;
    payType: 'hourly' | 'salary';
    rate: string;
    jobDate: string;
    jobStatus: 'active' | 'inactive' | 'on-leave';
    annualAmount?: string;
    payGroup: string;
    isPrimary?: boolean;
    [key: string]: unknown;
  }>;
  selectedEffectiveRangeIndex: number;
  jobCompensationRecords: Array<{
    effectiveStartDate: string;
    effectiveEndDate: string;
    jobs: Array<Record<string, unknown>>;
  }>;
  employeeId: string;
  onJobUpdated: () => void;
}

export function JobEditForm({
  jobs,
  selectedEffectiveRangeIndex,
  jobCompensationRecords,
  employeeId,
  onJobUpdated,
}: JobEditFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedJobIndex, setSelectedJobIndex] = useState<number>(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [validation, setValidation] = useState<{ errors: string[] }>({ errors: [] });
  const [showPrimaryWarning, setShowPrimaryWarning] = useState(false);
  const [newPrimaryJobIndex, setNewPrimaryJobIndex] = useState<number>(-1);
  const [formData, setFormData] = useState({
    payType: 'hourly' as 'hourly' | 'salary',
    rate: '',
    jobDate: '',
    endDate: '',
    jobStatus: 'active' as 'active' | 'inactive' | 'on-leave',
    annualAmount: '',
    payGroup: '',
  });

  // Helper: Check if end date is in the future (after today at 12:00 AM)
  const isEndDateInFuture = (endDateStr: string): boolean => {
    if (!endDateStr) return false;
    const endDate = new Date(endDateStr);
    const today = new Date();
    // Compare dates at 12:00 AM - set times to 0
    endDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return endDate.getTime() > today.getTime();
  };

  // Helper: Validate job status and end date relationship
  const validateStatusEndDateRelationship = (
    status: string,
    startDate: string,
    endDate: string,
    newErrors: string[] = []
  ): string[] => {
    const errors = [...newErrors];

    // Rule 0: End date cannot be before start date
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      if (end.getTime() < start.getTime()) {
        errors.push('End Date cannot be before Start Date');
      }
    }

    if (status === 'inactive') {
      // Rule 1: If status is inactive, end date must be set
      if (!endDate) {
        errors.push('End Date is required when Job Status is set to Inactive');
      }
    }

    if (endDate && status === 'inactive') {
      // Rule 2: If status is inactive but end date is in the future, warn and auto-correct
      if (isEndDateInFuture(endDate)) {
        // Auto-correct: If end date is future and status is inactive, change status to active
        return errors;
      }
    }

    if (endDate && isEndDateInFuture(endDate)) {
      // Rule 3: If end date is in the future, job must be Active (not inactive)
      // The UI will guide user but won't prevent - they can decide
      if (status === 'inactive') {
        errors.push(
          'Job Status should remain Active for future End Dates. The job will automatically become Inactive after the End Date.'
        );
      }
    }

    return errors;
  };

  // Handle status change with validation
  const handleStatusChange = (newStatus: string) => {
    const selectedJob = selectedJobIndex >= 0 ? jobs[selectedJobIndex] : null;

    // Check if trying to set primary job to inactive
    if (newStatus === 'inactive' && selectedJob?.isPrimary) {
      // Find other active jobs
      const otherActiveJobs = jobs.filter(
        (job, idx) => idx !== selectedJobIndex && job.jobStatus === 'active'
      );

      if (otherActiveJobs.length > 0) {
        // Show dialog to select new primary
        setShowPrimaryWarning(true);
        return;
      } else {
        // No other active jobs - show warning but allow proceed
        const confirmed = window.confirm(
          'Warning: Setting this job as Inactive will leave the employee with no active jobs. Do you want to proceed?'
        );
        if (!confirmed) {
          return;
        }
      }
    }

    const errors = validateStatusEndDateRelationship(newStatus, formData.jobDate, formData.endDate);
    setValidation({ errors });
    setFormData((prev) => ({
      ...prev,
      jobStatus: newStatus as 'active' | 'inactive' | 'on-leave',
    }));
  };

  // Handle end date change with validation
  const handleEndDateChange = (newEndDate: string) => {
    const errors = validateStatusEndDateRelationship(
      formData.jobStatus,
      formData.jobDate,
      newEndDate
    );
    setValidation({ errors });

    // Auto-correct: If end date is in future and status is inactive, change status to active
    if (newEndDate && isEndDateInFuture(newEndDate) && formData.jobStatus === 'inactive') {
      setFormData((prev) => ({
        ...prev,
        endDate: newEndDate,
        jobStatus: 'active',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        endDate: newEndDate,
      }));
    }
  };

  const selectedJob = selectedJobIndex >= 0 ? jobs[selectedJobIndex] : null;

  const handleSelectJob = (index: number) => {
    setSelectedJobIndex(index);
    setValidation({ errors: [] });
    const job = jobs[index];
    if (job) {
      setFormData({
        payType: job.payType,
        rate: job.rate,
        jobDate: job.jobDate,
        endDate: job.endDate || '',
        jobStatus: job.jobStatus,
        annualAmount: (job.annualAmount as string) || '',
        payGroup: job.payGroup,
      });
    }
  };

  const handleSave = async () => {
    if (isSaving || selectedJobIndex < 0) return;

    // Validate before saving
    const finalErrors = validateStatusEndDateRelationship(
      formData.jobStatus,
      formData.jobDate,
      formData.endDate
    );
    if (finalErrors.length > 0) {
      setValidation({ errors: finalErrors });
      return;
    }

    setIsSaving(true);
    try {
      // Get current employment details
      const response = await fetch(`/api/employees/${employeeId}/employment-details`);
      const { data } = await response.json();
      const employmentDetails = data?.employmentDetails || {};

      // Update the specific job in the compensation record
      const updatedRecords = [
        ...(employmentDetails.jobCompensationRecords || jobCompensationRecords),
      ];

      if (updatedRecords[selectedEffectiveRangeIndex]?.jobs[selectedJobIndex]) {
        updatedRecords[selectedEffectiveRangeIndex].jobs[selectedJobIndex] = {
          ...updatedRecords[selectedEffectiveRangeIndex].jobs[selectedJobIndex],
          payType: formData.payType,
          rate: formData.rate,
          jobDate: formData.jobDate,
          endDate: formData.endDate,
          jobStatus: formData.jobStatus,
          annualAmount: formData.annualAmount,
          payGroup: formData.payGroup,
        };

        // If we have a new primary job selected, update it
        if (newPrimaryJobIndex >= 0 && formData.jobStatus === 'inactive') {
          // Set old primary to non-primary
          updatedRecords[selectedEffectiveRangeIndex].jobs[selectedJobIndex].isPrimary = false;
          // Set new job as primary
          if (updatedRecords[selectedEffectiveRangeIndex].jobs[newPrimaryJobIndex]) {
            updatedRecords[selectedEffectiveRangeIndex].jobs[newPrimaryJobIndex].isPrimary = true;
          }
        }
      }

      // Save back to backend
      const saveResponse = await fetch(`/api/employees/${employeeId}/employment-details`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...employmentDetails,
          jobCompensationRecords: updatedRecords,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to update job');
      }

      // Reset form and close
      setIsEditing(false);
      setSelectedJobIndex(-1);
      setNewPrimaryJobIndex(-1);
      setShowPrimaryWarning(false);
      setFormData({
        payType: 'hourly',
        rate: '',
        jobDate: '',
        endDate: '',
        jobStatus: 'active',
        annualAmount: '',
        payGroup: '',
      });

      // Notify parent to refresh
      onJobUpdated();
    } catch (error) {
      console.error('Failed to update job:', error);
      alert('Failed to update job. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <a
        onClick={() => setIsEditing(true)}
        style={{
          fontSize: '0.9rem',
          color: 'var(--brand-primary)',
          cursor: 'pointer',
          fontWeight: 500,
          textDecoration: 'underline',
        }}
      >
        Edit Job
      </a>
    );
  }

  return (
    <>
      {/* Primary Job Warning Dialog */}
      {showPrimaryWarning && (
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
              Select New Primary Job
            </h3>
            <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              This job is currently the Primary Job. Please select a new Primary Job from the active
              jobs below:
            </p>
            <div style={{ marginBottom: '16px' }}>
              {jobs
                .map((job, idx) => ({ job, idx }))
                .filter(({ job, idx }) => idx !== selectedJobIndex && job.jobStatus === 'active')
                .map(({ job, idx }) => (
                  <label
                    key={idx}
                    style={{
                      display: 'block',
                      padding: '12px',
                      marginBottom: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor:
                        newPrimaryJobIndex === idx ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="newPrimary"
                      checked={newPrimaryJobIndex === idx}
                      onChange={() => setNewPrimaryJobIndex(idx)}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={{ fontWeight: 500 }}>
                      {job.department} - {job.jobTitle}
                    </span>
                  </label>
                ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowPrimaryWarning(false);
                  setNewPrimaryJobIndex(-1);
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
                onClick={() => {
                  if (newPrimaryJobIndex >= 0) {
                    setShowPrimaryWarning(false);
                    setFormData((prev) => ({
                      ...prev,
                      jobStatus: 'inactive',
                    }));
                  } else {
                    alert('Please select a new Primary Job');
                  }
                }}
                disabled={newPrimaryJobIndex < 0}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: newPrimaryJobIndex >= 0 ? 'var(--brand-primary)' : '#ccc',
                  color: 'white',
                  cursor: newPrimaryJobIndex >= 0 ? 'pointer' : 'not-allowed',
                  fontWeight: 500,
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        style={{
          padding: '16px',
          backgroundColor: 'var(--background-secondary)',
          border: '2px solid var(--brand-primary)',
          borderRadius: '4px',
          marginBottom: '16px',
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '0.95rem', fontWeight: 600 }}>
          Edit Job
        </h4>

        <div style={{ marginBottom: '12px' }}>
          <label
            style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}
          >
            Select Job to Edit
          </label>
          <select
            value={selectedJobIndex}
            onChange={(e) => handleSelectJob(Number(e.target.value))}
            disabled={isSaving}
            style={{
              width: '100%',
              padding: '6px',
              fontSize: '0.85rem',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            <option value="">Select a job...</option>
            {jobs.map((job, index) => (
              <option key={index} value={index}>
                {job.department} - {job.jobTitle}
              </option>
            ))}
          </select>
        </div>

        {selectedJob && (
          <>
            {validation.errors.length > 0 && (
              <div
                style={{
                  padding: '12px',
                  marginBottom: '16px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '4px',
                }}
              >
                {validation.errors.map((error, index) => (
                  <div
                    key={index}
                    style={{
                      color: '#991b1b',
                      fontSize: '0.85rem',
                      marginBottom: index < validation.errors.length - 1 ? '8px' : 0,
                    }}
                  >
                    • {error}
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: '12px',
                marginBottom: '12px',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    marginBottom: '4px',
                    fontWeight: 500,
                  }}
                >
                  Pay Type
                </label>
                <select
                  value={formData.payType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      payType: e.target.value as 'hourly' | 'salary',
                    }))
                  }
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    padding: '6px',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                  }}
                >
                  <option value="hourly">Hourly</option>
                  <option value="salary">Salary</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    marginBottom: '4px',
                    fontWeight: 500,
                  }}
                >
                  Rate
                </label>
                <input
                  type="text"
                  value={formData.rate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, rate: e.target.value }))}
                  disabled={isSaving}
                  placeholder="e.g., 15.50"
                  style={{
                    width: '100%',
                    padding: '6px',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    marginBottom: '4px',
                    fontWeight: 500,
                  }}
                >
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.jobDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, jobDate: e.target.value }))}
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    padding: '6px',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    marginBottom: '4px',
                    fontWeight: 500,
                  }}
                >
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    padding: '6px',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    borderColor: validation.errors.length > 0 ? '#dc2626' : 'var(--border)',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    marginBottom: '4px',
                    fontWeight: 500,
                  }}
                >
                  Status
                </label>
                <select
                  value={formData.jobStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    padding: '6px',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    borderColor: validation.errors.length > 0 ? '#dc2626' : 'var(--border)',
                  }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on-leave">On Leave</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    marginBottom: '4px',
                    fontWeight: 500,
                  }}
                >
                  Annual Comp.
                </label>
                <input
                  type="text"
                  value={formData.annualAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, annualAmount: e.target.value }))
                  }
                  disabled={isSaving}
                  placeholder="e.g., 52000"
                  style={{
                    width: '100%',
                    padding: '6px',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    marginBottom: '4px',
                    fontWeight: 500,
                  }}
                >
                  Pay Group
                </label>
                <input
                  type="text"
                  value={formData.payGroup}
                  onChange={(e) => setFormData((prev) => ({ ...prev, payGroup: e.target.value }))}
                  disabled={isSaving}
                  placeholder="e.g., Biweekly"
                  style={{
                    width: '100%',
                    padding: '6px',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSave}
                disabled={isSaving || selectedJobIndex < 0}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  backgroundColor: isSaving ? 'var(--text-secondary)' : 'var(--brand-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isSaving || selectedJobIndex < 0 ? 0.6 : 1,
                }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setSelectedJobIndex(-1);
                  setFormData({
                    payType: 'hourly',
                    rate: '',
                    jobDate: '',
                    endDate: '',
                    jobStatus: 'active',
                    annualAmount: '',
                    payGroup: '',
                  });
                }}
                disabled={isSaving}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isSaving ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

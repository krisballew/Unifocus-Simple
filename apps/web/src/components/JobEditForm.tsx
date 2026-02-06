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
    [key: string]: any;
  }>;
  selectedEffectiveRangeIndex: number;
  jobCompensationRecords: Array<{
    effectiveStartDate: string;
    effectiveEndDate: string;
    jobs: any[];
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
  const [formData, setFormData] = useState({
    payType: 'hourly' as 'hourly' | 'salary',
    rate: '',
    jobDate: '',
    endDate: '',
    jobStatus: 'active' as 'active' | 'inactive' | 'on-leave',
    annualAmount: '',
    payGroup: '',
  });

  const selectedJob = selectedJobIndex >= 0 ? jobs[selectedJobIndex] : null;

  const handleSelectJob = (index: number) => {
    setSelectedJobIndex(index);
    const job = jobs[index];
    if (job) {
      setFormData({
        payType: job.payType,
        rate: job.rate,
        jobDate: job.jobDate,
        endDate: job.endDate || '',
        jobStatus: job.jobStatus,
        annualAmount: job.annualAmount || '',
        payGroup: job.payGroup,
      });
    }
  };

  const handleSave = async () => {
    if (isSaving || selectedJobIndex < 0) return;

    setIsSaving(true);
    try {
      // Get current employment details
      const response = await fetch(`/api/employees/${employeeId}/employment-details`);
      const { data } = await response.json();
      const employmentDetails = data?.employmentDetails || {};

      // Update the specific job in the compensation record
      const updatedRecords = [...(employmentDetails.jobCompensationRecords || jobCompensationRecords)];
      
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
        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}>
                Pay Type
              </label>
              <select
                value={formData.payType}
                onChange={(e) => setFormData((prev) => ({ ...prev, payType: e.target.value as 'hourly' | 'salary' }))}
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
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}>
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
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}>
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
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}>
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}>
                Status
              </label>
              <select
                value={formData.jobStatus}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, jobStatus: e.target.value as 'active' | 'inactive' | 'on-leave' }))
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
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}>
                Annual Comp.
              </label>
              <input
                type="text"
                value={formData.annualAmount}
                onChange={(e) => setFormData((prev) => ({ ...prev, annualAmount: e.target.value }))}
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
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}>
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
  );
}

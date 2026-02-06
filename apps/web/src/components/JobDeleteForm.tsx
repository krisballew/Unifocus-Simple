import React, { useState } from 'react';

interface JobDeleteFormProps {
  jobs: Array<{
    id?: string;
    jobTitle: string;
    department: string;
    [key: string]: any;
  }>;
  selectedEffectiveRangeIndex: number;
  jobCompensationRecords: Array<{
    effectiveStartDate: string;
    effectiveEndDate: string;
    jobs: any[];
  }>;
  employeeId: string;
  onJobDeleted: () => void;
}

export function JobDeleteForm({
  jobs,
  selectedEffectiveRangeIndex,
  jobCompensationRecords,
  employeeId,
  onJobDeleted,
}: JobDeleteFormProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPrimaryJobId, setNewPrimaryJobId] = useState<string>('');
  const [showPrimaryJobWarning, setShowPrimaryJobWarning] = useState(false);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const isPrimaryJobSelected = selectedJob?.isPrimary;
  const otherJobs = jobs.filter((j) => j.id !== selectedJobId);
  const hasOtherJobs = otherJobs.length > 0;

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowConfirmation(false);
    setNewPrimaryJobId('');
    setShowPrimaryJobWarning(false);
  };

  const handleConfirmDelete = async () => {
    if (isSubmitting || !selectedJobId) return;

    // Check if deleting a primary job
    if (isPrimaryJobSelected && !hasOtherJobs) {
      setShowPrimaryJobWarning(true);
      return;
    }

    if (isPrimaryJobSelected && !newPrimaryJobId) {
      alert('Please select a new primary job before deleting the current primary job.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current employment details
      const response = await fetch(`/api/employees/${employeeId}/employment-details`);
      const { data } = await response.json();
      const employmentDetails = data?.employmentDetails || {};

      // Remove the job from the compensation record and update primary job if needed
      const updatedRecords = [...(employmentDetails.jobCompensationRecords || jobCompensationRecords)];
      updatedRecords[selectedEffectiveRangeIndex].jobs = updatedRecords[
        selectedEffectiveRangeIndex
      ].jobs
        .filter((j: any) => j.id !== selectedJobId)
        .map((j: any) => {
          if (isPrimaryJobSelected && j.id === newPrimaryJobId) {
            return { ...j, isPrimary: true };
          }
          return j;
        });

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
        throw new Error('Failed to delete job');
      }

      // Reset form and close
      setIsDeleting(false);
      setSelectedJobId('');
      setShowConfirmation(false);

      // Notify parent to refresh
      onJobDeleted();
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('Failed to delete job. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isDeleting) {
    return (
      <a
        onClick={() => setIsDeleting(true)}
        style={{
          fontSize: '0.9rem',
          color: '#dc2626',
          cursor: 'pointer',
          fontWeight: 500,
          textDecoration: 'underline',
        }}
      >
        Delete Job
      </a>
    );
  }

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: 'var(--background-secondary)',
        border: '2px solid #dc2626',
        borderRadius: '4px',
        marginBottom: '16px',
      }}
    >
      <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '0.95rem', fontWeight: 600, color: '#dc2626' }}>
        Delete Job
      </h4>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}>
          Select Job to Delete
        </label>
        <select
          value={selectedJobId}
          onChange={(e) => handleSelectJob(e.target.value)}
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '6px',
            fontSize: '0.85rem',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          <option value="">Select a job...</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.department} - {job.jobTitle}{job.isPrimary ? ' (Primary)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Show current primary job(s) */}
      <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Current primary job: <strong>{jobs.find(j => j.isPrimary)?.department} - {jobs.find(j => j.isPrimary)?.jobTitle || 'None set'}</strong>
        {jobs.length > 1 && <div style={{ marginTop: '4px', fontSize: '0.75rem' }}>Total jobs: {jobs.length}</div>}
      </div>

      {showPrimaryJobWarning && isPrimaryJobSelected && !hasOtherJobs && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fde047',
            borderRadius: '4px',
            marginBottom: '12px',
          }}
        >
          <p style={{ margin: '0', fontSize: '0.9rem', color: '#92400e', fontWeight: 600 }}>
            ⚠️ Cannot Delete Primary Job
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#b45309' }}>
            There must be at least 1 primary job. Please create another job before deleting this one.
          </p>
        </div>
      )}

      {selectedJob && isPrimaryJobSelected && hasOtherJobs && !showConfirmation && (
        <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#fef3c7', border: '1px solid #fde047', borderRadius: '4px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 600, color: '#92400e' }}>
            ⚠️ This is a primary job. Select a new primary job:
          </label>
          <select
            value={newPrimaryJobId}
            onChange={(e) => setNewPrimaryJobId(e.target.value)}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '6px',
              fontSize: '0.85rem',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            <option value="">Select new primary job...</option>
            {otherJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.department} - {job.jobTitle}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedJob && !showConfirmation && !showPrimaryJobWarning && (
        <div style={{ marginBottom: '12px' }}>
          {isPrimaryJobSelected && !newPrimaryJobId && hasOtherJobs && (
            <p style={{ fontSize: '0.85rem', color: '#b45309', marginBottom: '8px', fontStyle: 'italic' }}>
              ⚠️ Select a new primary job above before you can delete this one.
            </p>
          )}
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={isSubmitting || (isPrimaryJobSelected && !newPrimaryJobId)}
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              backgroundColor: isSubmitting || (isPrimaryJobSelected && !newPrimaryJobId) ? '#9ca3af' : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubmitting || (isPrimaryJobSelected && !newPrimaryJobId) ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: isSubmitting || (isPrimaryJobSelected && !newPrimaryJobId) ? 0.6 : 1,
            }}
          >
            {isSubmitting ? 'Deleting...' : 'Delete Selected Job'}
          </button>
        </div>
      )}

      {showConfirmation && selectedJob && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '4px',
            marginBottom: '12px',
          }}
        >
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#991b1b', fontWeight: 500 }}>
            Are you sure you want to delete this job?
          </p>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#7f1d1d' }}>
            <strong>Job:</strong> {selectedJob.department} - {selectedJob.jobTitle}
          </p>
          {isPrimaryJobSelected && newPrimaryJobId && (
            <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#7f1d1d' }}>
              <strong>New Primary Job:</strong> {jobs.find((j) => j.id === newPrimaryJobId)?.department} - {jobs.find((j) => j.id === newPrimaryJobId)?.jobTitle}
            </p>
          )}
          <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#7f1d1d' }}>
            This action cannot be undone.
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleConfirmDelete}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                fontSize: '0.85rem',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? 'Deleting...' : 'Yes, Delete Job'}
            </button>
            <button
              onClick={() => setShowConfirmation(false)}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                fontSize: '0.85rem',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showConfirmation && (
        <button
          onClick={() => {
            setIsDeleting(false);
            setSelectedJobId('');
          }}
          disabled={isSubmitting}
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            opacity: isSubmitting ? 0.5 : 1,
          }}
        >
          Close
        </button>
      )}
    </div>
  );
}

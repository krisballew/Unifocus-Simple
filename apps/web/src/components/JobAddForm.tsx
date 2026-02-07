import React, { useState } from 'react';

interface JobAddFormProps {
  jobStructure:
    | {
        divisions: Array<{
          id: string;
          name: string;
          departments: Array<{
            id: string;
            name: string;
            jobRoles: Array<{
              id: string;
              name: string;
              code?: string | null;
            }>;
          }>;
        }>;
      }
    | undefined;
  onJobAdded: () => void;
  selectedEffectiveRangeIndex: number;
  jobCompensationRecords: Array<{
    effectiveStartDate: string;
    effectiveEndDate: string;
    jobs: Array<Record<string, unknown>>;
  }>;
  employeeId: string;
}

export function JobAddForm({
  jobStructure,
  onJobAdded,
  selectedEffectiveRangeIndex,
  jobCompensationRecords,
  employeeId,
}: JobAddFormProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validation, setValidation] = useState<{ errors: string[] }>({ errors: [] });
  const [formData, setFormData] = useState({
    isPrimary: false,
    departmentId: '',
    jobRoleId: '',
    payType: 'hourly' as 'hourly' | 'salary',
    rate: '',
    jobDate: new Date().toISOString().split('T')[0],
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

  // Get all departments
  const allDepartments = React.useMemo(() => {
    const depts: Array<{ id: string; name: string; divisionName: string }> = [];
    jobStructure?.divisions.forEach((division) => {
      division.departments.forEach((department) => {
        depts.push({
          id: department.id,
          name: department.name,
          divisionName: division.name,
        });
      });
    });
    return depts;
  }, [jobStructure]);

  // Get job roles for selected department
  const availableJobRoles = React.useMemo(() => {
    if (!formData.departmentId) return [];
    const roles: Array<{ id: string; name: string; code: string }> = [];
    jobStructure?.divisions.forEach((division) => {
      division.departments.forEach((department) => {
        if (department.id === formData.departmentId) {
          department.jobRoles?.forEach((jobRole) => {
            roles.push({
              id: jobRole.id,
              name: jobRole.name,
              code: jobRole.code || '',
            });
          });
        }
      });
    });
    return roles;
  }, [jobStructure, formData.departmentId]);

  // Get details for selected job role
  const getJobRoleDetails = () => {
    for (const division of jobStructure?.divisions || []) {
      for (const department of division.departments) {
        const jobRole = department.jobRoles.find((r) => r.id === formData.jobRoleId);
        if (jobRole) {
          return {
            jobRole,
            department,
          };
        }
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (isSaving) return;

    const roleDetails = getJobRoleDetails();
    if (!roleDetails) {
      alert('Please select both Department and Job Role');
      return;
    }

    // Validate status and end date relationship
    const finalErrors = validateStatusEndDateRelationship(
      formData.jobStatus,
      formData.jobDate,
      formData.endDate
    );
    if (finalErrors.length > 0) {
      setValidation({ errors: finalErrors });
      return;
    }

    const { jobRole, department } = roleDetails;

    const newJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      jobRoleId: formData.jobRoleId,
      departmentId: formData.departmentId,
      jobCode: jobRole.code || '',
      jobTitle: jobRole.name,
      department: department.name,
      location: '',
      payType: formData.payType,
      rate: formData.rate,
      jobDate: formData.jobDate,
      endDate: formData.endDate,
      jobStatus: formData.jobStatus,
      payGroup: formData.payGroup,
      isPrimary: formData.isPrimary,
      subOnly: false,
      annualAmount: formData.annualAmount,
    };

    setIsSaving(true);

    try {
      // Get current employment details
      const response = await fetch(`/api/employees/${employeeId}/employment-details`);
      const { data } = await response.json();
      const employmentDetails = data?.employmentDetails || {};

      // Update the specific compensation record with new job
      const updatedRecords = [
        ...(employmentDetails.jobCompensationRecords || jobCompensationRecords),
      ];
      if (!updatedRecords[selectedEffectiveRangeIndex]) {
        updatedRecords[selectedEffectiveRangeIndex] = {
          effectiveStartDate: new Date().toISOString().split('T')[0],
          effectiveEndDate: 'Present',
          jobs: [],
        };
      }
      updatedRecords[selectedEffectiveRangeIndex].jobs.push(newJob);

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
        throw new Error('Failed to save job');
      }

      // Reset form
      setFormData({
        isPrimary: false,
        departmentId: '',
        jobRoleId: '',
        payType: 'hourly',
        rate: '',
        jobDate: new Date().toISOString().split('T')[0],
        endDate: '',
        jobStatus: 'active',
        annualAmount: '',
        payGroup: '',
      });
      setIsAdding(false);

      // Notify parent to refresh
      onJobAdded();
    } catch (error) {
      console.error('Failed to save job:', error);
      alert('Failed to save job. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdding) {
    return (
      <a
        onClick={() => setIsAdding(true)}
        style={{
          fontSize: '0.9rem',
          color: 'var(--brand-primary)',
          cursor: 'pointer',
          fontWeight: 500,
          textDecoration: 'underline',
        }}
      >
        Add Job
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
        Add New Job
      </h4>

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
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <div>
          <label
            style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}
          >
            Department
          </label>
          <select
            value={formData.departmentId}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                departmentId: e.target.value,
                jobRoleId: '', // Reset job role
              }))
            }
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
            <option value="">Select Department</option>
            {allDepartments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}
          >
            Job Role
          </label>
          <select
            value={formData.jobRoleId}
            onChange={(e) => setFormData((prev) => ({ ...prev, jobRoleId: e.target.value }))}
            disabled={!formData.departmentId || isSaving}
            style={{
              width: '100%',
              padding: '6px',
              fontSize: '0.85rem',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              opacity: isSaving || !formData.departmentId ? 0.6 : 1,
            }}
          >
            <option value="">Select Job</option>
            {availableJobRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
      </div>

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
            style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}
          >
            Pay Type
          </label>
          <select
            value={formData.payType}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, payType: e.target.value as 'hourly' | 'salary' }))
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
            style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}
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
            style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}
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
            style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}
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
            style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}
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
            style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}
          >
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
          <label
            style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', fontWeight: 500 }}
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

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={formData.isPrimary}
              onChange={(e) => setFormData((prev) => ({ ...prev, isPrimary: e.target.checked }))}
              disabled={isSaving}
            />
            Primary Job
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleSave}
          disabled={isSaving || !formData.departmentId || !formData.jobRoleId}
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem',
            backgroundColor: isSaving ? 'var(--text-secondary)' : 'var(--brand-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            opacity: isSaving || !formData.departmentId || !formData.jobRoleId ? 0.6 : 1,
          }}
        >
          {isSaving ? 'Saving...' : 'Save Job'}
        </button>
        <button
          onClick={() => {
            setIsAdding(false);
            setFormData({
              isPrimary: false,
              departmentId: '',
              jobRoleId: '',
              payType: 'hourly',
              rate: '',
              jobDate: new Date().toISOString().split('T')[0],
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
    </div>
  );
}

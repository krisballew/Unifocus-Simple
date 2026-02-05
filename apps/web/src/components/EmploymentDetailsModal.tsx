import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiClient, type Employee, saveEmploymentDetails } from '../services/api-client';
import { queryKeys } from '../services/query-keys';

interface EmploymentDetailsState {
  // Core Employment Record - Basic Information ONLY
  preferredName: string;
  manager: string;  // Populated from org structure mapping
  employmentStatus: 'active' | 'leave' | 'terminated';
  workAuthorizationVerified: boolean;
  contactInfo: string;
  emergencyContact: string;

  // Pay & Labor Setup - WITH Department & Job Role per job
  payType: 'hourly' | 'salary' | 'tipped';
  hourlyRate: string;
  salaryAmount: string;
  payrollGroup: string;
  overtimeEligible: boolean;
  tipPoolParticipation: boolean;
  
  // Job Roles (multiple per employee with per-job pay configuration)
  jobRoles: Array<{
    jobRoleId?: string;
    departmentId?: string;
    department?: string;
    jobTitle?: string;
    masterCategory?: string;
    payType?: string;
    hourlyRate?: string;
    salaryAmount?: string;
    payrollGroup?: string;
    isPrimary?: boolean;
  }>;

  // Scheduling Eligibility
  primaryRole: string;
  secondaryRoles: string;
  departmentEligibility: string;
  availability: string;
  maxWeeklyHours: string;
  overtimePreference: 'allow' | 'avoid';
  shiftPreference: 'AM' | 'PM' | 'overnight' | 'flexible';

  // Compliance & Certifications
  foodHandlerCertification: boolean;
  foodHandlerExpiry: string;
  alcoholCertification: boolean;
  alcoholExpiry: string;
  safetyTrainingCompleted: boolean;
  safetyTrainingExpiry: string;

  // Time & Attendance Controls
  ptoBalance: string;
  sickLeaveBalance: string;
  attendanceFlags: string;
  leaveOfAbsenceStatus: 'none' | 'active' | 'pending';
  clockPermissions: 'full' | 'restricted' | 'none';

  // Hotel-Specific Operational Data
  uniformSize: string;
  languagesSpoken: string;
  housekeepingZone: string;
  keycardAccessLevel: 'standard' | 'elevated' | 'restricted';
  maintenanceSpecialty: string;
  carAccessRequired: boolean;
  minorStatus: boolean;
  trainerEligible: boolean;
}

interface EmploymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  selectedPropertyId: string | null;
}

const emptyDetails: EmploymentDetailsState = {
  preferredName: '',
  manager: '',
  employmentStatus: 'active',
  workAuthorizationVerified: false,
  contactInfo: '',
  emergencyContact: '',
  payType: 'hourly',
  hourlyRate: '',
  salaryAmount: '',
  payrollGroup: '',
  overtimeEligible: false,
  tipPoolParticipation: false,
  jobRoles: [],
  primaryRole: '',
  secondaryRoles: '',
  departmentEligibility: '',
  availability: '',
  maxWeeklyHours: '',
  overtimePreference: 'allow',
  shiftPreference: 'flexible',
  foodHandlerCertification: false,
  foodHandlerExpiry: '',
  alcoholCertification: false,
  alcoholExpiry: '',
  safetyTrainingCompleted: false,
  safetyTrainingExpiry: '',
  ptoBalance: '',
  sickLeaveBalance: '',
  attendanceFlags: '',
  leaveOfAbsenceStatus: 'none',
  clockPermissions: 'full',
  uniformSize: '',
  languagesSpoken: '',
  housekeepingZone: '',
  keycardAccessLevel: 'standard',
  maintenanceSpecialty: '',
  carAccessRequired: false,
  minorStatus: false,
  trainerEligible: false,
};

export function EmploymentDetailsModal({
  isOpen,
  onClose,
  employee,
  selectedPropertyId,
}: EmploymentDetailsModalProps) {
  const queryClient = useQueryClient();
  const apiClient = getApiClient();
  const [details, setDetails] = useState<EmploymentDetailsState>(emptyDetails);
  const [activeTab, setActiveTab] = useState<'core' | 'pay' | 'scheduling' | 'compliance' | 'attendance' | 'hotel'>(
    'core'
  );

  // Initialize form with employee data and fetch existing employment details
  useEffect(() => {
    if (employee && isOpen) {
      // Set basic employee info - remove hire date (already on HR management screen)
      setDetails((prev) => ({
        ...prev,
        employmentStatus: employee.isActive ? 'active' : 'terminated',
      }));
      
      // Fetch existing employment details from API
      const fetchDetails = async () => {
        try {
          const response = await apiClient.get<{ data: { employmentDetails: Record<string, any> } }>(
            `/api/employees/${employee.id}/employment-details`
          );
          const employmentDetails = response.data?.employmentDetails || {};
          
          // Populate form with saved details if available
          if (Object.keys(employmentDetails).length > 0) {
            setDetails((prev) => ({
              ...prev,
              // Core Record - no hireDate
              preferredName: employmentDetails.preferredName || '',
              manager: employmentDetails.manager || '',
              workAuthorizationVerified: employmentDetails.workAuthorizationVerified || false,
              contactInfo: employmentDetails.contactInfo || '',
              emergencyContact: employmentDetails.emergencyContact || '',
              
              // Pay & Labor
              payType: employmentDetails.payType || 'hourly',
              hourlyRate: employmentDetails.hourlyRate || '',
              salaryAmount: employmentDetails.salaryAmount || '',
              payrollGroup: employmentDetails.payrollGroup || '',
              overtimeEligible: employmentDetails.overtimeEligible || false,
              tipPoolParticipation: employmentDetails.tipPoolParticipation || false,
              jobRoles: employmentDetails.jobRoles || [],
              
              // Scheduling
              primaryRole: employmentDetails.primaryRole || '',
              secondaryRoles: employmentDetails.secondaryRoles || '',
              availability: employmentDetails.availability || '',
              maxWeeklyHours: employmentDetails.maxWeeklyHours || '',
              overtimePreference: employmentDetails.overtimePreference || 'allow',
              shiftPreference: employmentDetails.shiftPreference || 'flexible',
              
              // Compliance
              foodHandlerCertification: employmentDetails.foodHandlerCertified || false,
              foodHandlerExpiry: employmentDetails.foodHandlerExpiry || '',
              alcoholCertification: employmentDetails.alcoholServerCertified || false,
              alcoholExpiry: employmentDetails.alcoholExpiry || '',
              safetyTrainingCompleted: employmentDetails.safetyTrainingCertified || false,
              safetyTrainingExpiry: employmentDetails.safetyTrainingExpiry || '',
              
              // Time & Attendance
              ptoBalance: employmentDetails.ptoBalance || '',
              sickLeaveBalance: employmentDetails.sickLeaveBalance || '',
              attendanceFlags: employmentDetails.attendanceFlags || '',
              leaveOfAbsenceStatus: employmentDetails.leaveOfAbsenceStatus || 'none',
              clockPermissions: employmentDetails.clockPermissions || 'full',
              
              // Hotel Operations
              uniformSize: employmentDetails.uniformSize || '',
              languagesSpoken: employmentDetails.languagesSpoken || '',
              housekeepingZone: employmentDetails.housekeepingZone || '',
              keycardAccessLevel: employmentDetails.keycardAccessLevel || 'standard',
              maintenanceSpecialty: employmentDetails.maintenanceSpecialty || '',
              carAccessRequired: employmentDetails.carAccessRequired || false,
              minorStatus: employmentDetails.minorStatus || false,
            }));
          }
        } catch (error) {
          console.warn('Failed to fetch employment details:', error);
          // Continue with defaults if fetch fails
        }
      };
      
      fetchDetails();
    }
  }, [employee, isOpen, apiClient]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id) throw new Error('Employee ID is required');
      
      // Convert form state to API payload format
      const payload = {
        // Core Record - basic info only, no hireDate
        preferredName: details.preferredName,
        manager: details.manager,
        employmentStatus: details.employmentStatus,
        workAuthorizationVerified: details.workAuthorizationVerified,
        contactInfo: details.contactInfo,
        emergencyContact: details.emergencyContact,
        
        // Pay & Labor - with job roles
        payType: details.payType,
        hourlyRate: details.hourlyRate,
        salaryAmount: details.salaryAmount,
        payrollGroup: details.payrollGroup,
        overtimeEligible: details.overtimeEligible,
        tipPoolParticipation: details.tipPoolParticipation,
        jobRoles: details.jobRoles,
        
        // Scheduling
        primaryRole: details.primaryRole,
        secondaryRoles: details.secondaryRoles,
        availability: details.availability,
        maxWeeklyHours: details.maxWeeklyHours,
        overtimePreference: details.overtimePreference,
        shiftPreference: details.shiftPreference,
        
        // Compliance
        foodHandlerCertified: details.foodHandlerCertification,
        foodHandlerExpiry: details.foodHandlerExpiry,
        alcoholServerCertified: details.alcoholCertification,
        alcoholExpiry: details.alcoholExpiry,
        safetyTrainingCertified: details.safetyTrainingCompleted,
        safetyTrainingExpiry: details.safetyTrainingExpiry,
        
        // Time & Attendance
        ptoBalance: details.ptoBalance,
        sickLeaveBalance: details.sickLeaveBalance,
        attendanceFlags: details.attendanceFlags,
        leaveOfAbsenceStatus: details.leaveOfAbsenceStatus,
        clockPermissions: details.clockPermissions,
        
        // Hotel Operations
        uniformSize: details.uniformSize,
        languagesSpoken: details.languagesSpoken,
        housekeepingZone: details.housekeepingZone,
        keycardAccessLevel: details.keycardAccessLevel,
        maintenanceSpecialty: details.maintenanceSpecialty,
        carAccessRequired: details.carAccessRequired,
        minorStatus: details.minorStatus,
      };
      
      return await saveEmploymentDetails(employee.id, payload as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees(selectedPropertyId ?? undefined),
      });
      onClose();
    },
  });

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to save employment details:', error);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content employment-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Employment Details</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'core' ? 'active' : ''}`}
            onClick={() => setActiveTab('core')}
          >
            Core Record
          </button>
          <button
            className={`modal-tab ${activeTab === 'pay' ? 'active' : ''}`}
            onClick={() => setActiveTab('pay')}
          >
            Pay & Labor
          </button>
          <button
            className={`modal-tab ${activeTab === 'scheduling' ? 'active' : ''}`}
            onClick={() => setActiveTab('scheduling')}
          >
            Scheduling
          </button>
          <button
            className={`modal-tab ${activeTab === 'compliance' ? 'active' : ''}`}
            onClick={() => setActiveTab('compliance')}
          >
            Compliance
          </button>
          <button
            className={`modal-tab ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            Time & Attendance
          </button>
          <button
            className={`modal-tab ${activeTab === 'hotel' ? 'active' : ''}`}
            onClick={() => setActiveTab('hotel')}
          >
            Operations
          </button>
        </div>

        <div className="modal-body">
          {/* Core Employment Record */}
          {activeTab === 'core' && (
            <div className="form-section-group">
              <h3>Core Employment Record</h3>
              <p className="form-description">Basic information for internal reference. Hire Date, Employee ID, and Department are managed elsewhere.</p>

              <div className="form-row">
                <div className="form-field">
                  <label>Preferred Name</label>
                  <input
                    type="text"
                    value={details.preferredName}
                    placeholder="Preferred name for communications"
                    onChange={(e) => setDetails((prev) => ({ ...prev, preferredName: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label>Manager</label>
                  <input
                    type="text"
                    value={details.manager}
                    placeholder="Populated from org structure"
                    disabled
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Employment Status</label>
                  <select
                    value={details.employmentStatus}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        employmentStatus: e.target.value as 'active' | 'leave' | 'terminated',
                      }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="leave">Leave</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={details.workAuthorizationVerified}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, workAuthorizationVerified: e.target.checked }))
                      }
                    />
                    Work Authorization Verified
                  </label>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Contact Info (Personal)</label>
                  <input
                    type="text"
                    value={details.contactInfo}
                    placeholder="Phone, address, or alternate contact"
                    onChange={(e) => setDetails((prev) => ({ ...prev, contactInfo: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label>Emergency Contact</label>
                  <input
                    type="text"
                    value={details.emergencyContact}
                    placeholder="Name and relationship"
                    onChange={(e) => setDetails((prev) => ({ ...prev, emergencyContact: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Pay & Labor Setup */}
          {activeTab === 'pay' && (
            <div className="form-section-group">
              <h3>Pay & Labor Setup</h3>
              <p className="form-description">Department, Job Roles, and pay configuration. Employees can have multiple job roles with different pay rates.</p>

              {/* Department & Job Roles Section */}
              <div className="form-row">
                <div className="form-field">
                  <label>Primary Department</label>
                  <input
                    type="text"
                    placeholder="Populated from labor structure"
                    disabled
                  />
                </div>
                <div className="form-field">
                  <label>Job Roles</label>
                  <input
                    type="text"
                    placeholder={details.jobRoles?.length ? `${details.jobRoles.length} role(s)` : 'Add from labor structure'}
                    disabled
                  />
                </div>
              </div>

              {/* Job Roles Details */}
              {details.jobRoles && details.jobRoles.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                    Configured Job Roles
                  </h4>
                  {details.jobRoles.map((job, idx) => (
                    <div key={idx} style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--surface-light)', borderRadius: '4px' }}>
                      <div style={{ fontWeight: '500', marginBottom: '8px', color: 'var(--text)' }}>
                        {job.jobTitle} {job.isPrimary ? '(Primary)' : ''}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {job.masterCategory && <span>Category: {job.masterCategory}</span>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
                        <div>
                          <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Pay Type</span>
                          <span>{job.payType || 'Not set'}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Rate</span>
                          <span>{job.hourlyRate || job.salaryAmount || 'Not set'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pay Configuration */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                  Default Pay Configuration
                </h4>

                <div className="form-row">
                  <div className="form-field">
                    <label>Pay Type</label>
                    <select
                      value={details.payType}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          payType: e.target.value as 'hourly' | 'salary' | 'tipped',
                        }))
                      }
                    >
                      <option value="hourly">Hourly</option>
                      <option value="salary">Salary</option>
                      <option value="tipped">Tipped</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Hourly Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      value={details.hourlyRate}
                      onChange={(e) => setDetails((prev) => ({ ...prev, hourlyRate: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label>Annual Salary</label>
                    <input
                      type="number"
                      step="0.01"
                      value={details.salaryAmount}
                      onChange={(e) => setDetails((prev) => ({ ...prev, salaryAmount: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-field">
                    <label>Payroll Group</label>
                    <input
                      type="text"
                      value={details.payrollGroup}
                      onChange={(e) => setDetails((prev) => ({ ...prev, payrollGroup: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={details.overtimeEligible}
                        onChange={(e) =>
                          setDetails((prev) => ({ ...prev, overtimeEligible: e.target.checked }))
                        }
                      />
                      Overtime Eligible
                    </label>
                  </div>
                  <div className="form-field">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={details.tipPoolParticipation}
                        onChange={(e) =>
                          setDetails((prev) => ({ ...prev, tipPoolParticipation: e.target.checked }))
                        }
                      />
                      Tip Pool Participation
                    </label>
                  </div>
                </div>

              <div className="form-row">
                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={details.minorStatus}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, minorStatus: e.target.checked }))
                      }
                    />
                    Minor Employee (age &lt; 18)
                  </label>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* Scheduling Eligibility */}
          {activeTab === 'scheduling' && (
            <div className="form-section-group">
              <h3>Scheduling Eligibility</h3>
              <p className="form-description">High-impact scheduling controls for manager flexibility.</p>

              <div className="form-row">
                <div className="form-field">
                  <label>Primary Role</label>
                  <input
                    type="text"
                    value={details.primaryRole}
                    onChange={(e) => setDetails((prev) => ({ ...prev, primaryRole: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label>Secondary Roles</label>
                  <input
                    type="text"
                    value={details.secondaryRoles}
                    onChange={(e) => setDetails((prev) => ({ ...prev, secondaryRoles: e.target.value }))}
                    placeholder="Comma-separated"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Department Eligibility</label>
                  <input
                    type="text"
                    value={details.departmentEligibility}
                    onChange={(e) => setDetails((prev) => ({ ...prev, departmentEligibility: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Availability</label>
                  <input
                    type="text"
                    value={details.availability}
                    onChange={(e) => setDetails((prev) => ({ ...prev, availability: e.target.value }))}
                    placeholder="e.g., Mon-Fri 9am-5pm"
                  />
                </div>
                <div className="form-field">
                  <label>Max Weekly Hours</label>
                  <input
                    type="number"
                    value={details.maxWeeklyHours}
                    onChange={(e) => setDetails((prev) => ({ ...prev, maxWeeklyHours: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Overtime Preference</label>
                  <select
                    value={details.overtimePreference}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        overtimePreference: e.target.value as 'allow' | 'avoid',
                      }))
                    }
                  >
                    <option value="allow">Allow</option>
                    <option value="avoid">Avoid</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Shift Preference</label>
                  <select
                    value={details.shiftPreference}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        shiftPreference: e.target.value as 'AM' | 'PM' | 'overnight' | 'flexible',
                      }))
                    }
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                    <option value="overnight">Overnight</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Compliance & Certifications */}
          {activeTab === 'compliance' && (
            <div className="form-section-group">
              <h3>Compliance & Certifications</h3>
              <p className="form-description">Track certifications and expiration dates for operational compliance.</p>

              <div className="form-row">
                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={details.foodHandlerCertification}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, foodHandlerCertification: e.target.checked }))
                      }
                    />
                    Food Handler Certification
                  </label>
                </div>
                <div className="form-field">
                  <label>Expiry Date</label>
                  <input
                    type="date"
                    value={details.foodHandlerExpiry}
                    onChange={(e) => setDetails((prev) => ({ ...prev, foodHandlerExpiry: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={details.alcoholCertification}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, alcoholCertification: e.target.checked }))
                      }
                    />
                    Alcohol Certification
                  </label>
                </div>
                <div className="form-field">
                  <label>Expiry Date</label>
                  <input
                    type="date"
                    value={details.alcoholExpiry}
                    onChange={(e) => setDetails((prev) => ({ ...prev, alcoholExpiry: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={details.safetyTrainingCompleted}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, safetyTrainingCompleted: e.target.checked }))
                      }
                    />
                    Safety Training Completed
                  </label>
                </div>
                <div className="form-field">
                  <label>Expiry Date</label>
                  <input
                    type="date"
                    value={details.safetyTrainingExpiry}
                    onChange={(e) => setDetails((prev) => ({ ...prev, safetyTrainingExpiry: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Time & Attendance Controls */}
          {activeTab === 'attendance' && (
            <div className="form-section-group">
              <h3>Time & Attendance Controls</h3>
              <p className="form-description">Lightweight structure to enforce attendance without heavy overhead.</p>

              <div className="form-row">
                <div className="form-field">
                  <label>PTO Balance</label>
                  <input
                    type="number"
                    step="0.5"
                    value={details.ptoBalance}
                    onChange={(e) => setDetails((prev) => ({ ...prev, ptoBalance: e.target.value }))}
                    placeholder="Hours"
                  />
                </div>
                <div className="form-field">
                  <label>Sick Leave Balance</label>
                  <input
                    type="number"
                    step="0.5"
                    value={details.sickLeaveBalance}
                    onChange={(e) => setDetails((prev) => ({ ...prev, sickLeaveBalance: e.target.value }))}
                    placeholder="Hours"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Attendance Flags</label>
                  <input
                    type="text"
                    value={details.attendanceFlags}
                    onChange={(e) => setDetails((prev) => ({ ...prev, attendanceFlags: e.target.value }))}
                    placeholder="Disciplinary notes (optional)"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Leave of Absence Status</label>
                  <select
                    value={details.leaveOfAbsenceStatus}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        leaveOfAbsenceStatus: e.target.value as 'none' | 'active' | 'pending',
                      }))
                    }
                  >
                    <option value="none">None</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Clock Permissions</label>
                  <select
                    value={details.clockPermissions}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        clockPermissions: e.target.value as 'full' | 'restricted' | 'none',
                      }))
                    }
                  >
                    <option value="full">Full</option>
                    <option value="restricted">Restricted</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Hotel-Specific Operational Data */}
          {activeTab === 'hotel' && (
            <div className="form-section-group">
              <h3>Hotel-Specific Operational Data</h3>
              <p className="form-description">Practical operational details for hotel management.</p>

              <div className="form-row">
                <div className="form-field">
                  <label>Uniform Size</label>
                  <input
                    type="text"
                    value={details.uniformSize}
                    onChange={(e) => setDetails((prev) => ({ ...prev, uniformSize: e.target.value }))}
                    placeholder="e.g., M, L, XL"
                  />
                </div>
                <div className="form-field">
                  <label>Languages Spoken</label>
                  <input
                    type="text"
                    value={details.languagesSpoken}
                    onChange={(e) => setDetails((prev) => ({ ...prev, languagesSpoken: e.target.value }))}
                    placeholder="Comma-separated"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Housekeeping Zone / Work Area</label>
                  <input
                    type="text"
                    value={details.housekeepingZone}
                    onChange={(e) => setDetails((prev) => ({ ...prev, housekeepingZone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Keycard Access Level</label>
                  <select
                    value={details.keycardAccessLevel}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        keycardAccessLevel: e.target.value as 'standard' | 'elevated' | 'restricted',
                      }))
                    }
                  >
                    <option value="standard">Standard</option>
                    <option value="elevated">Elevated</option>
                    <option value="restricted">Restricted</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Maintenance Specialty</label>
                  <input
                    type="text"
                    value={details.maintenanceSpecialty}
                    onChange={(e) => setDetails((prev) => ({ ...prev, maintenanceSpecialty: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={details.trainerEligible}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, trainerEligible: e.target.checked }))
                      }
                    />
                    Trainer Eligible
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Details'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import React, { useState, useEffect, useMemo } from 'react';

import {
  getApiClient,
  type Employee,
  saveEmploymentDetails,
  getJobStructure,
} from '../services/api-client';
import { queryKeys } from '../services/query-keys';

import { JobAddForm } from './JobAddForm';
import { JobDeleteForm } from './JobDeleteForm';
import { JobEditForm } from './JobEditForm';

interface EmploymentDetailsState {
  // Core Employment Record - Comprehensive Identity & Employment Relationship
  // Identifiers
  externalEmployeeId: string;
  legacyId: string;
  badgeCardId: string;
  biometricIdReference: string;

  // Employment Relationship
  employmentStatus: 'active' | 'leave' | 'terminated' | 'suspended';
  employmentType: 'full-time' | 'part-time' | 'seasonal' | 'temporary' | 'contractor';
  workerClassification: 'exempt' | 'non-exempt';
  flsaStatus: string;
  unionStatus: 'union' | 'non-union';
  bargainingUnit: string;
  employmentCategory: 'hourly' | 'salaried' | 'tipped' | 'commission';

  // Dates
  originalHireDate: string;
  mostRecentHireDate: string;
  seniorityDate: string;
  probationEndDate: string;
  terminationDate: string;
  terminationReason: string;
  rehireEligible: boolean;

  // Organizational Placement
  company: string;
  property: string;
  division: string;
  department: string;
  costCenter: string;
  workSiteLocation: string;

  // Reporting Structure
  managerId: string;
  managerName: string;
  secondaryManagerId: string;
  secondaryManagerName: string;
  hrBusinessPartner: string;
  timeApproverId: string;
  timeApproverName: string;

  // System Governance
  employmentRecordStatus: 'draft' | 'active' | 'archived';
  effectiveDate: string;
  recordVersion: string;

  // Legacy fields (to be removed or reorganized later)
  preferredName: string;
  contactInfo: string;
  emergencyContact: string;

  // Job & Compensation - Date-range-effective job management
  jobCompensationRecords: Array<{
    id?: string;
    effectiveStartDate: string;
    effectiveEndDate: string; // 'Present' for current
    jobs: Array<{
      id?: string;
      jobRoleId?: string; // Reference to job structure job role
      departmentId?: string; // Reference to job structure department
      jobCode: string;
      jobTitle: string;
      department: string;
      location: string;
      payType: 'hourly' | 'salary';
      rate: string;
      jobDate: string;
      endDate?: string;
      jobStatus: 'active' | 'inactive' | 'on-leave';
      payGroup: string;
      isPrimary: boolean;
      subOnly: boolean;
      annualAmount?: string;
      salaryDistribution?: string;
      hours?: string;
      notes?: string;
    }>;
  }>;
  selectedEffectiveRangeIndex: number;

  // Pay & Labor Setup - WITH Department & Job Role per job
  payType: 'hourly' | 'salary' | 'tipped';
  hourlyRate: string;
  salaryAmount: string;
  payrollGroup: string;
  tipPoolParticipation: boolean;
  overtimeEligible: boolean;

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
  // Core Employment Record - Identifiers
  externalEmployeeId: '',
  legacyId: '',
  badgeCardId: '',
  biometricIdReference: '',

  // Employment Relationship
  employmentStatus: 'active',
  employmentType: 'full-time',
  workerClassification: 'non-exempt',
  flsaStatus: '',
  unionStatus: 'non-union',
  bargainingUnit: '',
  employmentCategory: 'hourly',

  // Dates
  originalHireDate: '',
  mostRecentHireDate: '',
  seniorityDate: '',
  probationEndDate: '',
  terminationDate: '',
  terminationReason: '',
  rehireEligible: true,

  // Organizational Placement
  company: '',
  property: '',
  division: '',
  department: '',
  costCenter: '',
  workSiteLocation: '',

  // Reporting Structure
  managerId: '',
  managerName: '',
  secondaryManagerId: '',
  secondaryManagerName: '',
  hrBusinessPartner: '',
  timeApproverId: '',
  timeApproverName: '',

  // System Governance
  employmentRecordStatus: 'active',
  effectiveDate: '',
  recordVersion: '1.0',

  // Legacy fields
  preferredName: '',
  contactInfo: '',
  emergencyContact: '',

  // Job & Compensation - Date-range-effective job management
  jobCompensationRecords: [
    {
      effectiveStartDate: new Date().toISOString().split('T')[0],
      effectiveEndDate: 'Present',
      jobs: [],
    },
  ],
  selectedEffectiveRangeIndex: 0,

  // Pay & Labor fields
  payType: 'hourly',
  hourlyRate: '',
  salaryAmount: '',
  payrollGroup: '',
  tipPoolParticipation: false,
  overtimeEligible: false,
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
  const [activeTab, setActiveTab] = useState<
    'core' | 'jobpay' | 'pay' | 'scheduling' | 'compliance' | 'attendance' | 'hotel'
  >('core');

  // Trigger refresh when jobs are added
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);
  const [hideInactiveJobs, setHideInactiveJobs] = useState(true);

  // Re-fetch employment details when jobsRefreshKey changes
  useEffect(() => {
    if (employee && isOpen && jobsRefreshKey > 0) {
      const fetchDetails = async () => {
        try {
          const response = await getApiClient().get<{
            data: { employmentDetails: Record<string, unknown> };
          }>(`/api/employees/${employee.id}/employment-details`);
          const employmentDetails = response.data?.employmentDetails || {};
          if (
            Object.keys(employmentDetails).length > 0 &&
            employmentDetails.jobCompensationRecords
          ) {
            setDetails((prev) => ({
              ...prev,
              jobCompensationRecords: employmentDetails.jobCompensationRecords,
            }));
          }
        } catch (error) {
          console.warn('Failed to refresh employment details:', error);
        }
      };
      fetchDetails();
    }
  }, [jobsRefreshKey, employee, isOpen]);

  const jobStructureQuery = useQuery({
    queryKey: queryKeys.jobStructure(selectedPropertyId ?? undefined),
    queryFn: () => getJobStructure(selectedPropertyId!),
    enabled: Boolean(selectedPropertyId),
  });

  const formatCurrency = (value?: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '–';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parsed);
  };

  const getPayRateDisplay = (
    job: EmploymentDetailsState['jobCompensationRecords'][number]['jobs'][number]
  ) => {
    if (job.payType === 'salary') {
      const annualComp = Number(job.annualAmount);
      if (!Number.isFinite(annualComp)) return formatCurrency(job.rate);
      // Convert annual salary to hourly rate: 2,080 hours = 52 weeks × 5 days × 8 hours
      const hourlyRate = annualComp / 2080;
      return formatCurrency(String(hourlyRate));
    }
    return formatCurrency(job.rate);
  };

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    jobStructureQuery.data?.divisions.forEach((division) => {
      division.departments.forEach((department) => {
        map.set(department.id, department.name);
      });
    });
    return map;
  }, [jobStructureQuery.data]);

  const jobRoleById = useMemo(() => {
    const map = new Map<string, { name: string; code?: string | null; departmentId: string }>();
    jobStructureQuery.data?.divisions.forEach((division) => {
      division.departments.forEach((department) => {
        department.jobRoles.forEach((jobRole) => {
          map.set(jobRole.id, {
            name: jobRole.name,
            code: jobRole.code,
            departmentId: department.id,
          });
        });
      });
    });
    return map;
  }, [jobStructureQuery.data]);

  // Get all departments for dropdown
  const _allDepartments = useMemo(() => {
    const depts: Array<{ id: string; name: string; divisionName: string }> = [];
    jobStructureQuery.data?.divisions.forEach((division) => {
      division.departments.forEach((department) => {
        depts.push({
          id: department.id,
          name: department.name,
          divisionName: division.name,
        });
      });
    });
    return depts;
  }, [jobStructureQuery.data]);

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
          const response = await apiClient.get<{
            data: { employmentDetails: Record<string, unknown> };
          }>(`/api/employees/${employee.id}/employment-details`);
          const employmentDetails = response.data?.employmentDetails || {};

          // Populate form with saved details if available
          if (Object.keys(employmentDetails).length > 0) {
            setDetails((prev) => ({
              ...prev,
              // Core Record - Identifiers
              externalEmployeeId: employmentDetails.externalEmployeeId || '',
              legacyId: employmentDetails.legacyId || '',
              badgeCardId: employmentDetails.badgeCardId || '',
              biometricIdReference: employmentDetails.biometricIdReference || '',

              // Employment Relationship
              employmentType: employmentDetails.employmentType || 'full-time',
              workerClassification: employmentDetails.workerClassification || 'non-exempt',
              flsaStatus: employmentDetails.flsaStatus || '',
              unionStatus: employmentDetails.unionStatus || 'non-union',
              bargainingUnit: employmentDetails.bargainingUnit || '',
              employmentCategory: employmentDetails.employmentCategory || 'hourly',

              // Dates
              originalHireDate: employmentDetails.originalHireDate || '',
              mostRecentHireDate: employmentDetails.mostRecentHireDate || '',
              seniorityDate: employmentDetails.seniorityDate || '',
              probationEndDate: employmentDetails.probationEndDate || '',
              terminationDate: employmentDetails.terminationDate || '',
              terminationReason: employmentDetails.terminationReason || '',
              rehireEligible: employmentDetails.rehireEligible ?? true,

              // Organizational Placement
              company: employmentDetails.company || '',
              property: employmentDetails.property || '',
              division: employmentDetails.division || '',
              department: employmentDetails.department || '',
              costCenter: employmentDetails.costCenter || '',
              workSiteLocation: employmentDetails.workSiteLocation || '',

              // Reporting Structure
              managerId: employmentDetails.managerId || '',
              managerName: employmentDetails.managerName || '',
              secondaryManagerId: employmentDetails.secondaryManagerId || '',
              secondaryManagerName: employmentDetails.secondaryManagerName || '',
              hrBusinessPartner: employmentDetails.hrBusinessPartner || '',
              timeApproverId: employmentDetails.timeApproverId || '',
              timeApproverName: employmentDetails.timeApproverName || '',

              // System Governance
              employmentRecordStatus: employmentDetails.employmentRecordStatus || 'active',
              effectiveDate: employmentDetails.effectiveDate || '',
              recordVersion: employmentDetails.recordVersion || '1.0',

              // Legacy fields
              preferredName: employmentDetails.preferredName || '',
              contactInfo: employmentDetails.contactInfo || '',
              emergencyContact: employmentDetails.emergencyContact || '',

              // Job & Compensation - Date-range-effective job management
              jobCompensationRecords: employmentDetails.jobCompensationRecords || [
                {
                  effectiveStartDate: new Date().toISOString().split('T')[0],
                  effectiveEndDate: 'Present',
                  jobs: [],
                },
              ],
              selectedEffectiveRangeIndex: employmentDetails.selectedEffectiveRangeIndex ?? 0,

              // Pay & Labor
              payType: employmentDetails.payType || 'hourly',
              hourlyRate: employmentDetails.hourlyRate || '',
              salaryAmount: employmentDetails.salaryAmount || '',
              payrollGroup: employmentDetails.payrollGroup || '',
              tipPoolParticipation: employmentDetails.tipPoolParticipation || false,
              overtimeEligible: employmentDetails.overtimeEligible || false,
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
  }, [employee?.id, isOpen]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id) throw new Error('Employee ID is required');

      // Convert form state to API payload format
      const payload = {
        // Core Record - Identifiers
        externalEmployeeId: details.externalEmployeeId,
        legacyId: details.legacyId,
        badgeCardId: details.badgeCardId,
        biometricIdReference: details.biometricIdReference,

        // Employment Relationship
        employmentStatus: details.employmentStatus,
        employmentType: details.employmentType,
        workerClassification: details.workerClassification,
        flsaStatus: details.flsaStatus,
        unionStatus: details.unionStatus,
        bargainingUnit: details.bargainingUnit,
        employmentCategory: details.employmentCategory,

        // Dates
        originalHireDate: details.originalHireDate,
        mostRecentHireDate: details.mostRecentHireDate,
        seniorityDate: details.seniorityDate,
        probationEndDate: details.probationEndDate,
        terminationDate: details.terminationDate,
        terminationReason: details.terminationReason,
        rehireEligible: details.rehireEligible,

        // Organizational Placement
        company: details.company,
        property: details.property,
        division: details.division,
        department: details.department,
        costCenter: details.costCenter,
        workSiteLocation: details.workSiteLocation,

        // Reporting Structure
        managerId: details.managerId,
        managerName: details.managerName,
        secondaryManagerId: details.secondaryManagerId,
        secondaryManagerName: details.secondaryManagerName,
        hrBusinessPartner: details.hrBusinessPartner,
        timeApproverId: details.timeApproverId,
        timeApproverName: details.timeApproverName,

        // System Governance
        employmentRecordStatus: details.employmentRecordStatus,
        effectiveDate: details.effectiveDate,
        recordVersion: details.recordVersion,

        // Legacy fields
        preferredName: details.preferredName,
        contactInfo: details.contactInfo,
        emergencyContact: details.emergencyContact,

        // Job & Compensation - Date-range-effective job management
        jobCompensationRecords: details.jobCompensationRecords,
        selectedEffectiveRangeIndex: details.selectedEffectiveRangeIndex,

        // Pay & Labor - with job roles
        payType: details.payType,
        hourlyRate: details.hourlyRate,
        salaryAmount: details.salaryAmount,
        payrollGroup: details.payrollGroup,
        tipPoolParticipation: details.tipPoolParticipation,
        overtimeEligible: details.overtimeEligible,
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

      return await saveEmploymentDetails(employee.id, payload);
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
            Employee Details
          </button>
          <button
            className={`modal-tab ${activeTab === 'jobpay' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobpay')}
          >
            Job & Compensation
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
              <h3>Employee Details</h3>
              <p className="form-description">
                Identity and employment relationship anchor. Every other module keys off this
                record.
              </p>

              {/* IDENTIFIERS */}
              <div style={{ marginTop: '24px' }}>
                <h4
                  style={{
                    fontSize: '0.95rem',
                    marginBottom: '12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  Identifiers
                </h4>
                <div className="form-row">
                  <div className="form-field">
                    <label>Employee ID</label>
                    <input
                      type="text"
                      value={employee?.employeeId || 'Auto-generated'}
                      disabled
                      style={{ background: '#f8fafc', cursor: 'not-allowed' }}
                    />
                    <small
                      style={{ display: 'block', marginTop: '4px', color: 'var(--text-secondary)' }}
                    >
                      System generated, immutable
                    </small>
                  </div>
                  <div className="form-field">
                    <label>External Employee ID</label>
                    <input
                      type="text"
                      value={details.externalEmployeeId}
                      placeholder="Client/Payroll ID"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, externalEmployeeId: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Legacy ID</label>
                    <input
                      type="text"
                      value={details.legacyId}
                      placeholder="Migration reference ID"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, legacyId: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Badge/Card ID</label>
                    <input
                      type="text"
                      value={details.badgeCardId}
                      placeholder="Physical badge number"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, badgeCardId: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Biometric ID Reference</label>
                    <input
                      type="text"
                      value={details.biometricIdReference}
                      placeholder="Fingerprint or biometric system ID"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, biometricIdReference: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Preferred Name</label>
                    <input
                      type="text"
                      value={details.preferredName}
                      placeholder="Nickname or preferred name"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, preferredName: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* EMPLOYMENT RELATIONSHIP */}
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.95rem',
                    marginBottom: '12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  Employment Relationship
                </h4>
                <div className="form-row">
                  <div className="form-field">
                    <label>Employment Type</label>
                    <select
                      value={details.employmentType}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          employmentType: e.target.value,
                        }))
                      }
                    >
                      <option value="full-time">Full-time</option>
                      <option value="part-time">Part-time</option>
                      <option value="seasonal">Seasonal</option>
                      <option value="temporary">Temporary</option>
                      <option value="contractor">Contractor</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Worker Classification</label>
                    <select
                      value={details.workerClassification}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          workerClassification: e.target.value,
                        }))
                      }
                    >
                      <option value="exempt">Exempt</option>
                      <option value="non-exempt">Non-exempt</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>FLSA Status</label>
                    <input
                      type="text"
                      value={details.flsaStatus}
                      placeholder="Fair Labor Standards Act status"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, flsaStatus: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Union Status</label>
                    <select
                      value={details.unionStatus}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          unionStatus: e.target.value,
                        }))
                      }
                    >
                      <option value="non-union">Non-union</option>
                      <option value="union">Union</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Bargaining Unit</label>
                    <input
                      type="text"
                      value={details.bargainingUnit}
                      placeholder="Union bargaining unit"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, bargainingUnit: e.target.value }))
                      }
                      disabled={details.unionStatus === 'non-union'}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Employment Category</label>
                    <select
                      value={details.employmentCategory}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          employmentCategory: e.target.value,
                        }))
                      }
                    >
                      <option value="hourly">Hourly</option>
                      <option value="salaried">Salaried</option>
                      <option value="tipped">Tipped</option>
                      <option value="commission">Commission</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* DATES */}
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.95rem',
                    marginBottom: '12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  Dates
                </h4>
                <div className="form-row">
                  <div className="form-field">
                    <label>Original Hire Date</label>
                    <input
                      type="date"
                      value={details.originalHireDate}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, originalHireDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Most Recent Hire Date</label>
                    <input
                      type="date"
                      value={details.mostRecentHireDate}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, mostRecentHireDate: e.target.value }))
                      }
                    />
                    <small
                      style={{ display: 'block', marginTop: '4px', color: 'var(--text-secondary)' }}
                    >
                      For rehires
                    </small>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Seniority Date</label>
                    <input
                      type="date"
                      value={details.seniorityDate}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, seniorityDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Probation End Date</label>
                    <input
                      type="date"
                      value={details.probationEndDate}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, probationEndDate: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Termination Date</label>
                    <input
                      type="date"
                      value={details.terminationDate}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, terminationDate: e.target.value }))
                      }
                      disabled={details.employmentStatus !== 'terminated'}
                    />
                  </div>
                  <div className="form-field">
                    <label>Termination Reason</label>
                    <input
                      type="text"
                      value={details.terminationReason}
                      placeholder="Reason for termination"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, terminationReason: e.target.value }))
                      }
                      disabled={details.employmentStatus !== 'terminated'}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={details.rehireEligible}
                        onChange={(e) =>
                          setDetails((prev) => ({ ...prev, rehireEligible: e.target.checked }))
                        }
                        disabled={details.employmentStatus !== 'terminated'}
                      />
                      Rehire Eligible
                    </label>
                  </div>
                  <div className="form-field">{/* Spacer */}</div>
                </div>
              </div>

              {/* ORGANIZATIONAL PLACEMENT */}
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.95rem',
                    marginBottom: '12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  Organizational Placement
                </h4>
                <div className="form-row">
                  <div className="form-field">
                    <label>Company / Tenant</label>
                    <input
                      type="text"
                      value={details.company}
                      placeholder="Company name"
                      onChange={(e) => setDetails((prev) => ({ ...prev, company: e.target.value }))}
                    />
                  </div>
                  <div className="form-field">
                    <label>Property / Location</label>
                    <input
                      type="text"
                      value={employee?.property?.name || details.property}
                      placeholder="Property name"
                      disabled
                      style={{ background: '#f8fafc', cursor: 'not-allowed' }}
                    />
                    <small
                      style={{ display: 'block', marginTop: '4px', color: 'var(--text-secondary)' }}
                    >
                      Set from HR Management
                    </small>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Division</label>
                    <input
                      type="text"
                      value={details.division}
                      placeholder="Division or business unit"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, division: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Department</label>
                    <input
                      type="text"
                      value={details.department}
                      placeholder="Department"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, department: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Cost Center</label>
                    <input
                      type="text"
                      value={details.costCenter}
                      placeholder="Cost center code"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, costCenter: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Work Site / Location Code</label>
                    <input
                      type="text"
                      value={details.workSiteLocation}
                      placeholder="Physical work location"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, workSiteLocation: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* REPORTING STRUCTURE */}
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.95rem',
                    marginBottom: '12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  Reporting Structure
                </h4>
                <div className="form-row">
                  <div className="form-field">
                    <label>Manager ID</label>
                    <input
                      type="text"
                      value={details.managerId}
                      placeholder="Manager employee ID"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, managerId: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Manager Name</label>
                    <input
                      type="text"
                      value={details.managerName}
                      placeholder="Manager full name"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, managerName: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Secondary Manager / Acting Supervisor ID</label>
                    <input
                      type="text"
                      value={details.secondaryManagerId}
                      placeholder="Secondary manager employee ID"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, secondaryManagerId: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Secondary Manager Name</label>
                    <input
                      type="text"
                      value={details.secondaryManagerName}
                      placeholder="Secondary manager full name"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, secondaryManagerName: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>HR Business Partner</label>
                    <input
                      type="text"
                      value={details.hrBusinessPartner}
                      placeholder="Assigned HR contact"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, hrBusinessPartner: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Time Approver ID</label>
                    <input
                      type="text"
                      value={details.timeApproverId}
                      placeholder="Time approver employee ID"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, timeApproverId: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Time Approver Name</label>
                    <input
                      type="text"
                      value={details.timeApproverName}
                      placeholder="Time approver full name"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, timeApproverName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-field">{/* Spacer */}</div>
                </div>
              </div>

              {/* SYSTEM GOVERNANCE */}
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.95rem',
                    marginBottom: '12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  System Governance
                </h4>
                <div className="form-row">
                  <div className="form-field">
                    <label>Employment Record Status</label>
                    <select
                      value={details.employmentRecordStatus}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          employmentRecordStatus: e.target.value,
                        }))
                      }
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Effective Date</label>
                    <input
                      type="date"
                      value={details.effectiveDate}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, effectiveDate: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Record Version</label>
                    <input
                      type="text"
                      value={details.recordVersion}
                      disabled
                      style={{ background: '#f8fafc', cursor: 'not-allowed' }}
                    />
                    <small
                      style={{ display: 'block', marginTop: '4px', color: 'var(--text-secondary)' }}
                    >
                      Auto-incremented on save
                    </small>
                  </div>
                  <div className="form-field">{/* Spacer */}</div>
                </div>
              </div>

              {/* LEGACY / CONTACT INFO */}
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.95rem',
                    marginBottom: '12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  Additional Information
                </h4>
                <div className="form-row">
                  <div className="form-field">
                    <label>Contact Info (Personal)</label>
                    <input
                      type="text"
                      value={details.contactInfo}
                      placeholder="Phone, address, or alternate contact"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, contactInfo: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Emergency Contact</label>
                    <input
                      type="text"
                      value={details.emergencyContact}
                      placeholder="Name, relationship, and phone"
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, emergencyContact: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Job & Compensation - Date-range-effective job management */}
          {activeTab === 'jobpay' && (
            <div className="form-section-group">
              <h3>Job & Compensation</h3>
              <p className="form-description">
                Manage job assignments and compensation across different effective date ranges.
              </p>

              {/* JOBS TABLE - FULL WIDTH */}
              <div style={{ marginTop: '24px' }}>
                {/* ADD/EDIT/DELETE JOB FORMS */}
                <div style={{ marginBottom: '24px', display: 'flex', gap: '24px' }}>
                  <JobAddForm
                    jobStructure={jobStructureQuery.data}
                    onJobAdded={() => setJobsRefreshKey((prev) => prev + 1)}
                    selectedEffectiveRangeIndex={details.selectedEffectiveRangeIndex}
                    jobCompensationRecords={details.jobCompensationRecords}
                    employeeId={employee?.id || ''}
                  />
                  {details.jobCompensationRecords[details.selectedEffectiveRangeIndex]?.jobs &&
                    details.jobCompensationRecords[details.selectedEffectiveRangeIndex].jobs
                      .length > 0 && (
                      <>
                        <JobEditForm
                          jobs={
                            details.jobCompensationRecords[details.selectedEffectiveRangeIndex].jobs
                          }
                          onJobUpdated={() => setJobsRefreshKey((prev) => prev + 1)}
                          selectedEffectiveRangeIndex={details.selectedEffectiveRangeIndex}
                          jobCompensationRecords={details.jobCompensationRecords}
                          employeeId={employee?.id || ''}
                        />
                        <JobDeleteForm
                          jobs={
                            details.jobCompensationRecords[details.selectedEffectiveRangeIndex].jobs
                          }
                          onJobDeleted={() => setJobsRefreshKey((prev) => prev + 1)}
                          selectedEffectiveRangeIndex={details.selectedEffectiveRangeIndex}
                          jobCompensationRecords={details.jobCompensationRecords}
                          employeeId={employee?.id || ''}
                        />
                        <a
                          onClick={() => setHideInactiveJobs(!hideInactiveJobs)}
                          style={{
                            fontSize: '0.9rem',
                            color: 'var(--brand-primary)',
                            cursor: 'pointer',
                            fontWeight: 500,
                            textDecoration: 'underline',
                          }}
                        >
                          {hideInactiveJobs ? 'Show Inactive' : 'Hide Inactive'}
                        </a>
                      </>
                    )}
                </div>

                {/* JOBS TABLE */}
                <div>
                  <h4
                    style={{
                      fontSize: '0.95rem',
                      marginBottom: '12px',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                    }}
                  >
                    Jobs
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <div className="page-table" style={{ gap: '6px' }}>
                      <div
                        className="page-table__row page-table__header"
                        style={{ gridTemplateColumns: '0.5fr 2fr 1fr 1fr 1fr 1fr 1fr 1.2fr 1fr' }}
                      >
                        <div style={{ textAlign: 'center' }}>Primary</div>
                        <div>Department - Job</div>
                        <div>Pay Type</div>
                        <div>Pay Rate</div>
                        <div>Start Date</div>
                        <div>End Date</div>
                        <div>Job Status</div>
                        <div>Annual Comp.</div>
                        <div>Pay Group</div>
                      </div>
                      {/* Existing Jobs - filtered */}
                      {details.jobCompensationRecords[details.selectedEffectiveRangeIndex]?.jobs &&
                      details.jobCompensationRecords[details.selectedEffectiveRangeIndex].jobs
                        .length > 0 ? (
                        details.jobCompensationRecords[details.selectedEffectiveRangeIndex].jobs
                          .filter((job) => {
                            // Filter inactive jobs if hideInactiveJobs is true
                            if (hideInactiveJobs && job.jobStatus === 'inactive') {
                              return false;
                            }
                            return true;
                          })
                          .map((job, idx) => {
                            const jobRole = job.jobRoleId
                              ? jobRoleById.get(job.jobRoleId)
                              : undefined;
                            const departmentName = job.departmentId
                              ? departmentNameById.get(job.departmentId)
                              : jobRole?.departmentId
                                ? departmentNameById.get(jobRole.departmentId)
                                : undefined;
                            const jobTitle = jobRole?.name ?? job.jobTitle;
                            const departmentLabel = departmentName ?? job.department;

                            return (
                              <div
                                key={job.id || `job-${idx}`}
                                className="page-table__row is-selectable"
                                style={{
                                  gridTemplateColumns: '0.5fr 2fr 1fr 1fr 1fr 1fr 1fr 1.2fr 1fr',
                                }}
                              >
                                <div
                                  style={{
                                    textAlign: 'center',
                                    color: '#f59e0b',
                                    fontWeight: 600,
                                    fontSize: '1rem',
                                  }}
                                >
                                  {job.isPrimary ? '⭐' : ''}
                                </div>
                                <div
                                  style={{
                                    fontWeight: 500,
                                    color: 'var(--text-secondary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    minWidth: 0,
                                  }}
                                  title={`${departmentLabel} - ${jobTitle}`}
                                >
                                  {departmentLabel} - {jobTitle}
                                </div>
                                <div>{job.payType}</div>
                                <div>{getPayRateDisplay(job)}</div>
                                <div>{job.jobDate || '–'}</div>
                                <div>{job.endDate || '–'}</div>
                                <div>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      backgroundColor:
                                        job.jobStatus === 'active'
                                          ? 'rgba(34, 197, 94, 0.1)'
                                          : job.jobStatus === 'on-leave'
                                            ? 'rgba(59, 130, 246, 0.1)'
                                            : 'rgba(107, 114, 128, 0.1)',
                                      color:
                                        job.jobStatus === 'active'
                                          ? '#22c55e'
                                          : job.jobStatus === 'on-leave'
                                            ? '#3b82f6'
                                            : '#6b7280',
                                    }}
                                  >
                                    {job.jobStatus || '–'}
                                  </span>
                                </div>
                                <div>{job.annualAmount || '–'}</div>
                                <div>{job.payGroup || '–'}</div>
                              </div>
                            );
                          })
                      ) : (
                        <div
                          className="page-table__row"
                          style={{ gridTemplateColumns: '0.5fr 2fr 1fr 1fr 1fr 1fr 1.2fr 1fr' }}
                        >
                          <div
                            style={{
                              gridColumn: '1 / -1',
                              textAlign: 'center',
                              color: 'var(--text-secondary)',
                              fontSize: '0.9rem',
                            }}
                          >
                            No jobs configured for this date range.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pay & Labor Setup */}
          {activeTab === 'pay' && (
            <div className="form-section-group">
              <h3>Pay & Labor Setup</h3>
              <p className="form-description">
                Department, Job Roles, and pay configuration. Employees can have multiple job roles
                with different pay rates.
              </p>

              {/* Department & Job Roles Section */}
              <div className="form-row">
                <div className="form-field">
                  <label>Primary Department</label>
                  <input type="text" placeholder="Populated from labor structure" disabled />
                </div>
                <div className="form-field">
                  <label>Job Roles</label>
                  <input
                    type="text"
                    placeholder={
                      details.jobRoles?.length
                        ? `${details.jobRoles.length} role(s)`
                        : 'Add from labor structure'
                    }
                    disabled
                  />
                </div>
              </div>

              {/* Job Roles Details */}
              {details.jobRoles && details.jobRoles.length > 0 && (
                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <h4
                    style={{
                      fontSize: '0.95rem',
                      marginBottom: '12px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Configured Job Roles
                  </h4>
                  {details.jobRoles.map((job, idx) => (
                    <div
                      key={idx}
                      style={{
                        marginBottom: '16px',
                        padding: '12px',
                        backgroundColor: 'var(--surface-light)',
                        borderRadius: '4px',
                      }}
                    >
                      <div style={{ fontWeight: '500', marginBottom: '8px', color: 'var(--text)' }}>
                        {job.jobTitle} {job.isPrimary ? '(Primary)' : ''}
                      </div>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '8px',
                        }}
                      >
                        {job.masterCategory && <span>Category: {job.masterCategory}</span>}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '12px',
                          fontSize: '0.9rem',
                        }}
                      >
                        <div>
                          <span
                            style={{
                              display: 'block',
                              color: 'var(--text-secondary)',
                              fontSize: '0.8rem',
                            }}
                          >
                            Pay Type
                          </span>
                          <span>{job.payType || 'Not set'}</span>
                        </div>
                        <div>
                          <span
                            style={{
                              display: 'block',
                              color: 'var(--text-secondary)',
                              fontSize: '0.8rem',
                            }}
                          >
                            Rate
                          </span>
                          <span>{job.hourlyRate || job.salaryAmount || 'Not set'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pay Configuration */}
              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.95rem',
                    marginBottom: '12px',
                    color: 'var(--text-secondary)',
                  }}
                >
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
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, hourlyRate: e.target.value }))
                      }
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
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, salaryAmount: e.target.value }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-field">
                    <label>Payroll Group</label>
                    <input
                      type="text"
                      value={details.payrollGroup}
                      onChange={(e) =>
                        setDetails((prev) => ({ ...prev, payrollGroup: e.target.value }))
                      }
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
                          setDetails((prev) => ({
                            ...prev,
                            tipPoolParticipation: e.target.checked,
                          }))
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
              <p className="form-description">
                High-impact scheduling controls for manager flexibility.
              </p>

              <div className="form-row">
                <div className="form-field">
                  <label>Primary Role</label>
                  <input
                    type="text"
                    value={details.primaryRole}
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, primaryRole: e.target.value }))
                    }
                  />
                </div>
                <div className="form-field">
                  <label>Secondary Roles</label>
                  <input
                    type="text"
                    value={details.secondaryRoles}
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, secondaryRoles: e.target.value }))
                    }
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
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, departmentEligibility: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Availability</label>
                  <input
                    type="text"
                    value={details.availability}
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, availability: e.target.value }))
                    }
                    placeholder="e.g., Mon-Fri 9am-5pm"
                  />
                </div>
                <div className="form-field">
                  <label>Max Weekly Hours</label>
                  <input
                    type="number"
                    value={details.maxWeeklyHours}
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, maxWeeklyHours: e.target.value }))
                    }
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
              <p className="form-description">
                Track certifications and expiration dates for operational compliance.
              </p>

              <div className="form-row">
                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={details.foodHandlerCertification}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          foodHandlerCertification: e.target.checked,
                        }))
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
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, foodHandlerExpiry: e.target.value }))
                    }
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
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, alcoholExpiry: e.target.value }))
                    }
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
                        setDetails((prev) => ({
                          ...prev,
                          safetyTrainingCompleted: e.target.checked,
                        }))
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
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, safetyTrainingExpiry: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Time & Attendance Controls */}
          {activeTab === 'attendance' && (
            <div className="form-section-group">
              <h3>Time & Attendance Controls</h3>
              <p className="form-description">
                Lightweight structure to enforce attendance without heavy overhead.
              </p>

              <div className="form-row">
                <div className="form-field">
                  <label>PTO Balance</label>
                  <input
                    type="number"
                    step="0.5"
                    value={details.ptoBalance}
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, ptoBalance: e.target.value }))
                    }
                    placeholder="Hours"
                  />
                </div>
                <div className="form-field">
                  <label>Sick Leave Balance</label>
                  <input
                    type="number"
                    step="0.5"
                    value={details.sickLeaveBalance}
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, sickLeaveBalance: e.target.value }))
                    }
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
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, attendanceFlags: e.target.value }))
                    }
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
              <p className="form-description">
                Practical operational details for hotel management.
              </p>

              <div className="form-row">
                <div className="form-field">
                  <label>Uniform Size</label>
                  <input
                    type="text"
                    value={details.uniformSize}
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, uniformSize: e.target.value }))
                    }
                    placeholder="e.g., M, L, XL"
                  />
                </div>
                <div className="form-field">
                  <label>Languages Spoken</label>
                  <input
                    type="text"
                    value={details.languagesSpoken}
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, languagesSpoken: e.target.value }))
                    }
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
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, housekeepingZone: e.target.value }))
                    }
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
                        keycardAccessLevel: e.target.value as
                          | 'standard'
                          | 'elevated'
                          | 'restricted',
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
                    onChange={(e) =>
                      setDetails((prev) => ({ ...prev, maintenanceSpecialty: e.target.value }))
                    }
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
          <button className="button primary" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Details'}
          </button>
        </div>
      </div>
    </div>
  );
}

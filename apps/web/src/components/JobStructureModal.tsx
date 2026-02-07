import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import { useSelection } from '../context/SelectionContext';
import { useToast } from '../hooks/useToast';
import {
  getJobStructure,
  createDivision,
  createDepartment,
  createJobRole,
  createJobAssignment,
  updateDivision,
  updateDepartment,
  updateJobRole,
  updateJobAssignment,
  type Division,
  type Department,
  type JobRole,
  type JobAssignment,
} from '../services/api-client';
import { queryKeys } from '../services/query-keys';

type TabType = 'view' | 'division' | 'department' | 'job' | 'assignment';

interface JobStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DetailModalType =
  | { type: 'division'; data: Division }
  | { type: 'department'; data: Department }
  | { type: 'job'; data: JobRole }
  | { type: 'assignment'; data: JobAssignment }
  | null;

export function JobStructureModal({ isOpen, onClose }: JobStructureModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('view');
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [expandedJobRoles, setExpandedJobRoles] = useState<Set<string>>(new Set());
  const [detailModal, setDetailModal] = useState<DetailModalType>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [detailFormValues, setDetailFormValues] = useState<
    Record<string, string | number | boolean | undefined>
  >({});
  const { selectedPropertyId, isHydrated } = useSelection();
  const propertyId = selectedPropertyId;
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Fetch job structure
  const { data: jobStructure, isLoading: isLoadingStructure } = useQuery({
    queryKey: queryKeys.jobStructure(propertyId!),
    queryFn: () => getJobStructure(propertyId!),
    enabled: isOpen && !!propertyId && isHydrated,
  });

  // Division creation
  const [divisionForm, setDivisionForm] = useState({ name: '', code: '' });
  const createDivisionMutation = useMutation({
    mutationFn: () =>
      createDivision({
        propertyId: propertyId!,
        name: divisionForm.name,
        code: divisionForm.code || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobStructure(propertyId!) });
      setDivisionForm({ name: '', code: '' });
      showToast('Division created successfully', 'success');
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to create division', 'error');
    },
  });

  // Department creation
  const [departmentForm, setDepartmentForm] = useState({
    divisionId: '',
    departmentCategoryId: '',
    name: '',
    code: '',
  });
  const createDepartmentMutation = useMutation({
    mutationFn: () =>
      createDepartment({
        propertyId: propertyId!,
        divisionId: departmentForm.divisionId,
        departmentCategoryId: departmentForm.departmentCategoryId,
        name: departmentForm.name,
        code: departmentForm.code || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobStructure(propertyId!) });
      setDepartmentForm({ divisionId: '', departmentCategoryId: '', name: '', code: '' });
      showToast('Department created successfully', 'success');
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to create department', 'error');
    },
  });

  // Job role creation
  const [jobForm, setJobForm] = useState({
    departmentId: '',
    jobCategoryId: '',
    name: '',
    code: '',
  });
  const createJobRoleMutation = useMutation({
    mutationFn: () =>
      createJobRole({
        propertyId: propertyId!,
        departmentId: jobForm.departmentId,
        jobCategoryId: jobForm.jobCategoryId,
        name: jobForm.name,
        code: jobForm.code || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobStructure(propertyId!) });
      setJobForm({ departmentId: '', jobCategoryId: '', name: '', code: '' });
      showToast('Job role created successfully', 'success');
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to create job role', 'error');
    },
  });

  // Assignment creation
  const [assignmentForm, setAssignmentForm] = useState({
    jobRoleId: '',
    name: '',
    code: '',
  });
  const createAssignmentMutation = useMutation({
    mutationFn: () =>
      createJobAssignment({
        propertyId: propertyId!,
        jobRoleId: assignmentForm.jobRoleId,
        name: assignmentForm.name,
        code: assignmentForm.code || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobStructure(propertyId!) });
      setAssignmentForm({ jobRoleId: '', name: '', code: '' });
      showToast('Assignment created successfully', 'success');
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to create assignment', 'error');
    },
  });

  // Update mutations for detail modal
  const updateDivisionMutation = useMutation({
    mutationFn: (data: Record<string, string | number | boolean | undefined>) =>
      updateDivision(detailModal!.data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobStructure(propertyId!) });
      setIsEditingDetail(false);
      setDetailFormValues({});
      showToast('Division updated successfully', 'success');
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to update division', 'error');
    },
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: (data: Record<string, string | number | boolean | undefined>) =>
      updateDepartment(detailModal!.data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobStructure(propertyId!) });
      setIsEditingDetail(false);
      setDetailFormValues({});
      showToast('Department updated successfully', 'success');
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to update department', 'error');
    },
  });

  const updateJobRoleMutation = useMutation({
    mutationFn: (data: Record<string, string | number | boolean | undefined>) =>
      updateJobRole(detailModal!.data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobStructure(propertyId!) });
      setIsEditingDetail(false);
      setDetailFormValues({});
      showToast('Job role updated successfully', 'success');
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to update job role', 'error');
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: (data: Record<string, string | number | boolean | undefined>) =>
      updateJobAssignment(detailModal!.data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobStructure(propertyId!) });
      setIsEditingDetail(false);
      setDetailFormValues({});
      showToast('Assignment updated successfully', 'success');
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to update assignment', 'error');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-content job-structure-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Job Structure Guided Configuration</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="job-structure-tabs">
          <button
            className={`tab-button ${activeTab === 'view' ? 'active' : ''}`}
            onClick={() => setActiveTab('view')}
          >
            View Structure
          </button>
          <button
            className={`tab-button ${activeTab === 'division' ? 'active' : ''}`}
            onClick={() => setActiveTab('division')}
          >
            Add Division
          </button>
          <button
            className={`tab-button ${activeTab === 'department' ? 'active' : ''}`}
            onClick={() => setActiveTab('department')}
          >
            Add Department
          </button>
          <button
            className={`tab-button ${activeTab === 'job' ? 'active' : ''}`}
            onClick={() => setActiveTab('job')}
          >
            Add Job
          </button>
          <button
            className={`tab-button ${activeTab === 'assignment' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignment')}
          >
            Add Assignment
          </button>
        </div>

        <div className="modal-body">
          {/* View Structure Tab */}
          {activeTab === 'view' && (
            <div className="tab-content">
              {isLoadingStructure ? (
                <p>Loading job structure...</p>
              ) : jobStructure && jobStructure.divisions.length > 0 ? (
                <div className="structure-grid">
                  <div className="grid-header">
                    <div className="grid-col-name">Name</div>
                    <div className="grid-col-type">Type</div>
                    <div className="grid-col-category">Category</div>
                    <div className="grid-col-count">Count</div>
                    <div className="grid-col-actions">Actions</div>
                  </div>
                  {jobStructure.divisions.map((division) => {
                    const isDivisionExpanded = expandedDivisions.has(division.id);
                    return (
                      <React.Fragment key={division.id}>
                        <div className="grid-row division-row">
                          <div className="grid-col-name">
                            <button
                              className="expand-btn"
                              onClick={() => {
                                const newExpanded = new Set(expandedDivisions);
                                if (isDivisionExpanded) {
                                  newExpanded.delete(division.id);
                                } else {
                                  newExpanded.add(division.id);
                                }
                                setExpandedDivisions(newExpanded);
                              }}
                            >
                              {isDivisionExpanded ? '▼' : '▶'}
                            </button>
                            <span className="item-name">{division.name}</span>
                          </div>
                          <div className="grid-col-type">
                            <span className="type-badge division-badge">Division</span>
                          </div>
                          <div className="grid-col-category">—</div>
                          <div className="grid-col-count">
                            {division.departments.length} dept(s)
                          </div>
                          <div className="grid-col-actions">
                            <button
                              className="action-btn"
                              onClick={() => setDetailModal({ type: 'division', data: division })}
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                        {isDivisionExpanded &&
                          division.departments.map((dept) => {
                            const isDeptExpanded = expandedDepartments.has(dept.id);
                            return (
                              <React.Fragment key={dept.id}>
                                <div className="grid-row department-row">
                                  <div className="grid-col-name dept-indent">
                                    <button
                                      className="expand-btn"
                                      onClick={() => {
                                        const newExpanded = new Set(expandedDepartments);
                                        if (isDeptExpanded) {
                                          newExpanded.delete(dept.id);
                                        } else {
                                          newExpanded.add(dept.id);
                                        }
                                        setExpandedDepartments(newExpanded);
                                      }}
                                    >
                                      {isDeptExpanded ? '▼' : '▶'}
                                    </button>
                                    <span className="item-name">{dept.name}</span>
                                  </div>
                                  <div className="grid-col-type">
                                    <span className="type-badge department-badge">Department</span>
                                  </div>
                                  <div className="grid-col-category">
                                    <span className="category-tag">
                                      {dept.departmentCategory?.name || '—'}
                                    </span>
                                  </div>
                                  <div className="grid-col-count">
                                    {dept.jobRoles.length} job(s)
                                  </div>
                                  <div className="grid-col-actions">
                                    <button
                                      className="action-btn"
                                      onClick={() =>
                                        setDetailModal({ type: 'department', data: dept })
                                      }
                                    >
                                      View Details
                                    </button>
                                  </div>
                                </div>
                                {isDeptExpanded &&
                                  dept.jobRoles.map((job) => {
                                    const isJobExpanded = expandedJobRoles.has(job.id);
                                    return (
                                      <React.Fragment key={job.id}>
                                        <div className="grid-row job-row">
                                          <div className="grid-col-name job-indent">
                                            {job.jobAssignments && job.jobAssignments.length > 0 ? (
                                              <button
                                                className="expand-btn"
                                                onClick={() => {
                                                  const newExpanded = new Set(expandedJobRoles);
                                                  if (isJobExpanded) {
                                                    newExpanded.delete(job.id);
                                                  } else {
                                                    newExpanded.add(job.id);
                                                  }
                                                  setExpandedJobRoles(newExpanded);
                                                }}
                                              >
                                                {isJobExpanded ? '▼' : '▶'}
                                              </button>
                                            ) : (
                                              <span className="expand-btn-placeholder"></span>
                                            )}
                                            <span className="item-name">{job.name}</span>
                                          </div>
                                          <div className="grid-col-type">
                                            <span className="type-badge job-badge">Job Role</span>
                                          </div>
                                          <div className="grid-col-category">
                                            <span className="category-tag">
                                              {job.jobCategory?.name || '—'}
                                            </span>
                                          </div>
                                          <div className="grid-col-count">
                                            {job.jobAssignments?.length || 0} assignment(s)
                                          </div>
                                          <div className="grid-col-actions">
                                            <button
                                              className="action-btn"
                                              onClick={() =>
                                                setDetailModal({ type: 'job', data: job })
                                              }
                                            >
                                              View Details
                                            </button>
                                          </div>
                                        </div>
                                        {isJobExpanded &&
                                          job.jobAssignments &&
                                          job.jobAssignments.map((assign) => (
                                            <div
                                              key={assign.id}
                                              className="grid-row assignment-row"
                                            >
                                              <div className="grid-col-name assignment-indent">
                                                <span className="expand-btn-placeholder"></span>
                                                <span className="item-name">{assign.name}</span>
                                              </div>
                                              <div className="grid-col-type">
                                                <span className="type-badge assignment-badge">
                                                  Assignment
                                                </span>
                                              </div>
                                              <div className="grid-col-category">—</div>
                                              <div className="grid-col-count">—</div>
                                              <div className="grid-col-actions">
                                                <button
                                                  className="action-btn"
                                                  onClick={() =>
                                                    setDetailModal({
                                                      type: 'assignment',
                                                      data: assign,
                                                    })
                                                  }
                                                >
                                                  View Details
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                      </React.Fragment>
                                    );
                                  })}
                              </React.Fragment>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
                <p className="modal-empty">
                  No job structure configured yet. Create a division to get started.
                </p>
              )}
            </div>
          )}

          {/* Add Division Tab */}
          {activeTab === 'division' && (
            <div className="tab-content">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createDivisionMutation.mutate();
                }}
              >
                <div className="form-group">
                  <label htmlFor="division-name">Division Name *</label>
                  <input
                    id="division-name"
                    type="text"
                    value={divisionForm.name}
                    onChange={(e) => setDivisionForm({ ...divisionForm, name: e.target.value })}
                    placeholder="e.g., Operations, Sales"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="division-code">Division Code</label>
                  <input
                    id="division-code"
                    type="text"
                    value={divisionForm.code}
                    onChange={(e) => setDivisionForm({ ...divisionForm, code: e.target.value })}
                    placeholder="e.g., OPS"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!divisionForm.name || createDivisionMutation.isPending}
                  className="btn-primary"
                >
                  {createDivisionMutation.isPending ? 'Creating...' : 'Create Division'}
                </button>
              </form>
            </div>
          )}

          {/* Add Department Tab */}
          {activeTab === 'department' && (
            <div className="tab-content">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createDepartmentMutation.mutate();
                }}
              >
                <div className="form-group">
                  <label htmlFor="division-select">Division *</label>
                  <select
                    id="division-select"
                    value={departmentForm.divisionId}
                    onChange={(e) =>
                      setDepartmentForm({ ...departmentForm, divisionId: e.target.value })
                    }
                    required
                  >
                    <option value="">Select a division</option>
                    {jobStructure?.divisions.map((div) => (
                      <option key={div.id} value={div.id}>
                        {div.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="dept-category-select">Department Category *</label>
                  <select
                    id="dept-category-select"
                    value={departmentForm.departmentCategoryId}
                    onChange={(e) =>
                      setDepartmentForm({
                        ...departmentForm,
                        departmentCategoryId: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Select a category</option>
                    {jobStructure?.departmentCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="dept-name">Department Name *</label>
                  <input
                    id="dept-name"
                    type="text"
                    value={departmentForm.name}
                    onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                    placeholder="e.g., Engineering"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="dept-code">Department Code</label>
                  <input
                    id="dept-code"
                    type="text"
                    value={departmentForm.code}
                    onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })}
                    placeholder="e.g., ENG"
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    !departmentForm.divisionId ||
                    !departmentForm.departmentCategoryId ||
                    !departmentForm.name ||
                    createDepartmentMutation.isPending
                  }
                  className="btn-primary"
                >
                  {createDepartmentMutation.isPending ? 'Creating...' : 'Create Department'}
                </button>
              </form>
            </div>
          )}

          {/* Add Job Tab */}
          {activeTab === 'job' && (
            <div className="tab-content">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createJobRoleMutation.mutate();
                }}
              >
                <div className="form-group">
                  <label htmlFor="dept-select">Department *</label>
                  <select
                    id="dept-select"
                    value={jobForm.departmentId}
                    onChange={(e) => setJobForm({ ...jobForm, departmentId: e.target.value })}
                    required
                  >
                    <option value="">Select a department</option>
                    {jobStructure?.divisions.flatMap((div) =>
                      div.departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {div.name} • {dept.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="job-category-select">Job Category *</label>
                  <select
                    id="job-category-select"
                    value={jobForm.jobCategoryId}
                    onChange={(e) => setJobForm({ ...jobForm, jobCategoryId: e.target.value })}
                    required
                  >
                    <option value="">Select a category</option>
                    {jobStructure?.jobCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="job-name">Job Role Name *</label>
                  <input
                    id="job-name"
                    type="text"
                    value={jobForm.name}
                    onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })}
                    placeholder="e.g., Software Engineer"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="job-code">Job Code</label>
                  <input
                    id="job-code"
                    type="text"
                    value={jobForm.code}
                    onChange={(e) => setJobForm({ ...jobForm, code: e.target.value })}
                    placeholder="e.g., SE"
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    !jobForm.departmentId ||
                    !jobForm.jobCategoryId ||
                    !jobForm.name ||
                    createJobRoleMutation.isPending
                  }
                  className="btn-primary"
                >
                  {createJobRoleMutation.isPending ? 'Creating...' : 'Create Job Role'}
                </button>
              </form>
            </div>
          )}

          {/* Add Assignment Tab */}
          {activeTab === 'assignment' && (
            <div className="tab-content">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createAssignmentMutation.mutate();
                }}
              >
                <div className="form-group">
                  <label htmlFor="job-role-select">Job Role *</label>
                  <select
                    id="job-role-select"
                    value={assignmentForm.jobRoleId}
                    onChange={(e) =>
                      setAssignmentForm({ ...assignmentForm, jobRoleId: e.target.value })
                    }
                    required
                  >
                    <option value="">Select a job role</option>
                    {jobStructure?.divisions.flatMap((div) =>
                      div.departments.flatMap((dept) =>
                        dept.jobRoles.map((job) => (
                          <option key={job.id} value={job.id}>
                            {div.name} • {dept.name} • {job.name}
                          </option>
                        ))
                      )
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="assign-name">Assignment Name *</label>
                  <input
                    id="assign-name"
                    type="text"
                    value={assignmentForm.name}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, name: e.target.value })}
                    placeholder="e.g., Backend Developer, Frontend Developer"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="assign-code">Assignment Code</label>
                  <input
                    id="assign-code"
                    type="text"
                    value={assignmentForm.code}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, code: e.target.value })}
                    placeholder="e.g., BE"
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    !assignmentForm.jobRoleId ||
                    !assignmentForm.name ||
                    createAssignmentMutation.isPending
                  }
                  className="btn-primary"
                >
                  {createAssignmentMutation.isPending ? 'Creating...' : 'Create Assignment'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {detailModal.type === 'division' && 'Division Details'}
                {detailModal.type === 'department' && 'Department Details'}
                {detailModal.type === 'job' && 'Job Role Details'}
                {detailModal.type === 'assignment' && 'Assignment Details'}
              </h2>
              <button className="modal-close" onClick={() => setDetailModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {/* View Mode */}
              {!isEditingDetail && (
                <div className="detail-view">
                  {detailModal.type === 'division' && (
                    <>
                      <div className="detail-field">
                        <label>Name</label>
                        <div className="detail-value">{detailModal.data.name}</div>
                      </div>
                      <div className="detail-field">
                        <label>Code</label>
                        <div className="detail-value">{detailModal.data.code || '—'}</div>
                      </div>
                    </>
                  )}
                  {detailModal.type === 'department' && (
                    <>
                      <div className="detail-field">
                        <label>Name</label>
                        <div className="detail-value">{detailModal.data.name}</div>
                      </div>
                      <div className="detail-field">
                        <label>Code</label>
                        <div className="detail-value">{detailModal.data.code || '—'}</div>
                      </div>
                      <div className="detail-field">
                        <label>Category</label>
                        <div className="detail-value">
                          {detailModal.data.departmentCategory?.name || '—'}
                        </div>
                      </div>
                      <div className="detail-field">
                        <label>Cost Center</label>
                        <div className="detail-value">{detailModal.data.costCenter || '—'}</div>
                      </div>
                      <div className="detail-field">
                        <label>Labor Budget</label>
                        <div className="detail-value">
                          {detailModal.data.laborBudget
                            ? `$${Number(detailModal.data.laborBudget).toLocaleString()}`
                            : '—'}
                        </div>
                      </div>
                      <div className="detail-field">
                        <label>Location</label>
                        <div className="detail-value">{detailModal.data.location || '—'}</div>
                      </div>
                      <div className="detail-field">
                        <label>Reporting Group</label>
                        <div className="detail-value">
                          {detailModal.data.reportingGroupId || '—'}
                        </div>
                      </div>
                    </>
                  )}
                  {detailModal.type === 'job' && (
                    <>
                      <div className="detail-field">
                        <label>Name</label>
                        <div className="detail-value">{detailModal.data.name}</div>
                      </div>
                      <div className="detail-field">
                        <label>Code</label>
                        <div className="detail-value">{detailModal.data.code || '—'}</div>
                      </div>
                      <div className="detail-field">
                        <label>Category</label>
                        <div className="detail-value">
                          {detailModal.data.jobCategory?.name || '—'}
                        </div>
                      </div>
                      <div className="detail-field">
                        <label>Pay Code</label>
                        <div className="detail-value">{detailModal.data.payCode || '—'}</div>
                      </div>
                      <div className="detail-field">
                        <label>Skill Classification</label>
                        <div className="detail-value">
                          {detailModal.data.skillClassification || '—'}
                        </div>
                      </div>
                      <div className="detail-field">
                        <label>FLSA Status</label>
                        <div className="detail-value">{detailModal.data.flsaStatus || '—'}</div>
                      </div>
                      <div className="detail-field">
                        <label>Union Classification</label>
                        <div className="detail-value">
                          {detailModal.data.unionClassification || '—'}
                        </div>
                      </div>
                      <div className="detail-field">
                        <label>Certification Requirements</label>
                        <div className="detail-value">
                          {detailModal.data.certificationRequirements &&
                          detailModal.data.certificationRequirements.length > 0
                            ? detailModal.data.certificationRequirements.join(', ')
                            : '—'}
                        </div>
                      </div>
                    </>
                  )}
                  {detailModal.type === 'assignment' && (
                    <>
                      <div className="detail-field">
                        <label>Name</label>
                        <div className="detail-value">{detailModal.data.name}</div>
                      </div>
                      <div className="detail-field">
                        <label>Code</label>
                        <div className="detail-value">{detailModal.data.code || '—'}</div>
                      </div>
                      <div className="detail-field">
                        <label>Description</label>
                        <div className="detail-value">{detailModal.data.description || '—'}</div>
                      </div>
                    </>
                  )}
                  <div className="detail-modal-footer">
                    <button
                      className="btn-edit"
                      onClick={() => {
                        setIsEditingDetail(true);
                        setDetailFormValues({ ...detailModal.data });
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Mode */}
              {isEditingDetail && (
                <div className="detail-view">
                  {detailModal.type === 'division' && (
                    <>
                      <div className="detail-field">
                        <label>Name</label>
                        <input
                          type="text"
                          value={detailFormValues.name || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Code</label>
                        <input
                          type="text"
                          value={detailFormValues.code || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, code: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}
                  {detailModal.type === 'department' && (
                    <>
                      <div className="detail-field">
                        <label>Name</label>
                        <input
                          type="text"
                          value={detailFormValues.name || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Code</label>
                        <input
                          type="text"
                          value={detailFormValues.code || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, code: e.target.value })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Cost Center</label>
                        <input
                          type="text"
                          value={detailFormValues.costCenter || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, costCenter: e.target.value })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Labor Budget</label>
                        <input
                          type="number"
                          value={detailFormValues.laborBudget || ''}
                          onChange={(e) =>
                            setDetailFormValues({
                              ...detailFormValues,
                              laborBudget: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Location</label>
                        <input
                          type="text"
                          value={detailFormValues.location || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, location: e.target.value })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Reporting Group</label>
                        <input
                          type="text"
                          value={detailFormValues.reportingGroupId || ''}
                          onChange={(e) =>
                            setDetailFormValues({
                              ...detailFormValues,
                              reportingGroupId: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}
                  {detailModal.type === 'job' && (
                    <>
                      <div className="detail-field">
                        <label>Name</label>
                        <input
                          type="text"
                          value={detailFormValues.name || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Code</label>
                        <input
                          type="text"
                          value={detailFormValues.code || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, code: e.target.value })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Pay Code</label>
                        <input
                          type="text"
                          value={detailFormValues.payCode || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, payCode: e.target.value })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Skill Classification</label>
                        <input
                          type="text"
                          value={detailFormValues.skillClassification || ''}
                          onChange={(e) =>
                            setDetailFormValues({
                              ...detailFormValues,
                              skillClassification: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>FLSA Status</label>
                        <input
                          type="text"
                          value={detailFormValues.flsaStatus || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, flsaStatus: e.target.value })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Union Classification</label>
                        <input
                          type="text"
                          value={detailFormValues.unionClassification || ''}
                          onChange={(e) =>
                            setDetailFormValues({
                              ...detailFormValues,
                              unionClassification: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Certification Requirements</label>
                        <textarea
                          value={
                            Array.isArray(detailFormValues.certificationRequirements)
                              ? detailFormValues.certificationRequirements.join(', ')
                              : ''
                          }
                          onChange={(e) =>
                            setDetailFormValues({
                              ...detailFormValues,
                              certificationRequirements: e.target.value
                                .split(',')
                                .map((c) => c.trim()),
                            })
                          }
                          placeholder="Comma-separated list of certifications"
                        />
                      </div>
                    </>
                  )}
                  {detailModal.type === 'assignment' && (
                    <>
                      <div className="detail-field">
                        <label>Name</label>
                        <input
                          type="text"
                          value={detailFormValues.name || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Code</label>
                        <input
                          type="text"
                          value={detailFormValues.code || ''}
                          onChange={(e) =>
                            setDetailFormValues({ ...detailFormValues, code: e.target.value })
                          }
                        />
                      </div>
                      <div className="detail-field">
                        <label>Description</label>
                        <textarea
                          value={detailFormValues.description || ''}
                          onChange={(e) =>
                            setDetailFormValues({
                              ...detailFormValues,
                              description: e.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}
                  <div className="detail-modal-footer">
                    <button
                      className="btn-save"
                      onClick={() => {
                        if (detailModal.type === 'division') {
                          updateDivisionMutation.mutate({
                            name: detailFormValues.name,
                            code: detailFormValues.code,
                          });
                        } else if (detailModal.type === 'department') {
                          updateDepartmentMutation.mutate({
                            name: detailFormValues.name,
                            code: detailFormValues.code,
                            costCenter: detailFormValues.costCenter,
                            laborBudget: detailFormValues.laborBudget,
                            location: detailFormValues.location,
                            reportingGroupId: detailFormValues.reportingGroupId,
                          });
                        } else if (detailModal.type === 'job') {
                          updateJobRoleMutation.mutate({
                            name: detailFormValues.name,
                            code: detailFormValues.code,
                            payCode: detailFormValues.payCode,
                            skillClassification: detailFormValues.skillClassification,
                            flsaStatus: detailFormValues.flsaStatus,
                            unionClassification: detailFormValues.unionClassification,
                            certificationRequirements: detailFormValues.certificationRequirements,
                          });
                        } else if (detailModal.type === 'assignment') {
                          updateAssignmentMutation.mutate({
                            name: detailFormValues.name,
                            code: detailFormValues.code,
                            description: detailFormValues.description,
                          });
                        }
                      }}
                      disabled={
                        updateDivisionMutation.isPending ||
                        updateDepartmentMutation.isPending ||
                        updateJobRoleMutation.isPending ||
                        updateAssignmentMutation.isPending
                      }
                    >
                      Save Changes
                    </button>
                    <button
                      className="btn-cancel"
                      onClick={() => {
                        setIsEditingDetail(false);
                        setDetailFormValues({});
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

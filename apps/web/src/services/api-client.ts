import { getAuthService } from './cognito-auth';

interface FetchOptions extends RequestInit {
  baseUrl?: string;
}

class ApiClient {
  private baseUrl: string;
  private isDev: boolean;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // In development mode, we can use the Vite proxy for all API calls
    this.isDev = import.meta.env.DEV;
  }

  /**
   * Make API request with automatic token attachment
   */
  async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    // In development, use relative paths to leverage Vite proxy
    const url = this.isDev && !options.baseUrl ? path : `${options.baseUrl || this.baseUrl}${path}`;
    const headers = {
      ...options.headers,
    } as Record<string, string>;

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    // Attach authorization token if available
    let token: string | null = null;

    try {
      const authService = getAuthService();
      token = authService.getAccessToken();
    } catch {
      // Auth service not initialized, try localStorage
    }

    // Fallback to localStorage token if auth service doesn't have one
    if (!token) {
      token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    }

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      // Note: In dev mode with mock tokens, the backend will fetch the dev user from the database
      // so we don't need to send x-tenant-id and x-user-id headers
    }

    // In development, honor the logged-in user from localStorage if present
    if (import.meta.env.DEV) {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser) as { id?: string; tenantId?: string };
          if (user.id && !headers['x-user-id']) {
            headers['x-user-id'] = user.id;
          }
          if (user.tenantId && !headers['x-tenant-id']) {
            headers['x-tenant-id'] = user.tenantId;
          }
        }
      } catch {
        // Ignore malformed user cache
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async get<T>(path: string, options?: FetchOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string, options?: FetchOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

let apiClient: ApiClient | null = null;

export function initializeApiClient(baseUrl: string): ApiClient {
  apiClient = new ApiClient(baseUrl);
  return apiClient;
}

export function getApiClient(): ApiClient {
  if (!apiClient) {
    throw new Error('API client not initialized');
  }
  return apiClient;
}

// ========== API Endpoints ==========

export interface User {
  userId: string;
  email: string;
  username: string;
  name?: string;
  tenantId?: string;
  roles: string[];
  scopes: string[];
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  name: string;
  tenantId: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface Employee {
  id: string;
  tenantId: string;
  propertyId: string;
  employeeId?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  hireDate?: string | null;
  isActive: boolean;
  employmentStatus?: string;
  terminationDate?: string;
  terminationReason?: string;
  employmentStatusChangedOn?: string;
  employmentStatusChangedBy?: string;
  property?: {
    id: string;
    name: string;
    city?: string | null;
    state?: string | null;
  } | null;
}

export interface Shift {
  id: string;
  tenantId: string;
  scheduleId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  tenantId: string;
  propertyId: string;
  employeeId: string;
  startDate: string;
  endDate?: string;
  name?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  shifts?: Shift[];
}

export interface Punch {
  id: string;
  tenantId: string;
  employeeId: string;
  shiftId?: string;
  type: 'in' | 'out' | 'break_start' | 'break_end';
  timestamp: string;
  latitude?: number;
  longitude?: number;
  deviceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Exception {
  id: string;
  tenantId: string;
  employeeId: string;
  type: string;
  reason?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobCategory {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  description?: string;
  isActive: boolean;
}

export interface DepartmentCategory {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  description?: string;
  isActive: boolean;
}

export interface JobRole {
  id: string;
  tenantId: string;
  propertyId: string;
  departmentId: string;
  jobCategoryId: string;
  name: string;
  code?: string;
  description?: string;
  isActive: boolean;
  jobCategory?: JobCategory;
  payCode?: string;
  skillClassification?: string;
  unionClassification?: string;
  flsaStatus?: string;
  certificationRequirements?: string[];
  jobAssignments: JobAssignment[];
}

export interface JobAssignment {
  id: string;
  tenantId: string;
  propertyId: string;
  jobRoleId: string;
  name: string;
  code?: string;
  description?: string;
  isActive: boolean;
}

export interface Department {
  id: string;
  tenantId: string;
  propertyId: string;
  divisionId: string;
  departmentCategoryId: string;
  name: string;
  code?: string;
  departmentCategory?: DepartmentCategory;
  costCenter?: string;
  laborBudget?: string | number;
  location?: string;
  reportingGroupId?: string;
  managerId?: string;
  jobRoles: JobRole[];
}

export interface Division {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  code?: string;
  departments: Department[];
}

export interface JobStructure {
  propertyId: string;
  divisions: Division[];
  departmentCategories: DepartmentCategory[];
  jobCategories: JobCategory[];
}

export async function getCurrentUser(): Promise<User> {
  const client = getApiClient();
  return client.get<User>('/api/me');
}

export async function getTenants(): Promise<Tenant[]> {
  const client = getApiClient();
  return client.get<Tenant[]>('/api/me/tenants');
}

export async function getTenant(tenantId: string): Promise<Tenant> {
  const client = getApiClient();
  return client.get<Tenant>(`/api/tenants/${tenantId}`);
}

export async function getTenantProperties(tenantId: string): Promise<Property[]> {
  const client = getApiClient();
  return client.get<Property[]>(`/api/tenants/${tenantId}/properties`);
}

export async function getProperties(): Promise<Property[]> {
  const client = getApiClient();
  return client.get<Property[]>('/api/properties');
}

export async function getEmployees(propertyId?: string): Promise<Employee[]> {
  const client = getApiClient();
  const params = new URLSearchParams();
  if (propertyId) params.set('propertyId', propertyId);
  const query = params.toString();
  const response = await client.get<{ data: Employee[] }>(
    `/api/employees${query ? `?${query}` : ''}`
  );
  return response.data ?? [];
}

export async function createEmployee(payload: {
  propertyId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  hireDate?: string | null;
}): Promise<Employee> {
  const client = getApiClient();
  const response = await client.post<{ data: Employee }>('/api/employees', payload);
  return response.data;
}

export async function updateEmployee(
  employeeId: string,
  payload: {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    phone?: string | null;
    hireDate?: string | null;
    isActive?: boolean;
    employmentStatus?: string;
    terminationDate?: string;
    terminationReason?: string;
    employmentStatusChangedBy?: string;
  }
): Promise<Employee> {
  const client = getApiClient();
  const response = await client.patch<{ data: Employee }>(`/api/employees/${employeeId}`, payload);
  return response.data;
}

export async function deactivateEmployee(employeeId: string): Promise<Employee> {
  const client = getApiClient();
  const response = await client.patch<{ data: Employee }>(
    `/api/employees/${employeeId}/deactivate`
  );
  return response.data;
}

// ========== EMPLOYMENT DETAILS ==========

export interface EmploymentDetails {
  // Core Record (Basic Information)
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  hireDate?: string;
  isActive?: boolean;

  // Pay & Labor Setup
  payType?: string;
  hourlyRate?: string;
  salaryAmount?: string;
  payrollGroup?: string;
  ptoAccrualBucket?: string;
  ptoAccrualsAnnually?: boolean;
  specialPayAdjustments?: boolean;

  // Scheduling
  primaryRole?: string;
  secondaryRoles?: string;
  departmentEligibility?: string;
  availability?: string;
  maxWeeklyHours?: string;
  overtimePreference?: string;
  shiftPreference?: string;

  // Compliance & Certifications
  foodHandlerCertified?: boolean;
  foodHandlerExpiry?: string;
  alcoholServerCertified?: boolean;
  alcoholExpiry?: string;
  safetyTrainingCertified?: boolean;
  safetyTrainingExpiry?: string;

  // Time & Attendance
  ptoBalance?: string;
  sickLeaveBalance?: string;
  attendanceFlags?: string;
  leaveOfAbsenceStatus?: string;
  clockPermissions?: string;

  // Hotel-Specific Operations
  uniformSize?: string;
  languagesSpoken?: string;
  housekeepingZone?: string;
  keycardAccessLevel?: string;
  maintenanceSpecialty?: string;
  carAccessRequired?: boolean;
  minorStatus?: boolean;
}

export async function getEmploymentDetails(employeeId: string): Promise<EmploymentDetails> {
  const client = getApiClient();
  const response = await client.get<{ data: { employmentDetails: EmploymentDetails } }>(
    `/api/employees/${employeeId}/employment-details`
  );
  return response.data?.employmentDetails ?? {};
}

export async function saveEmploymentDetails(
  employeeId: string,
  details: EmploymentDetails
): Promise<Employee> {
  const client = getApiClient();
  const response = await client.put<{ data: Employee }>(
    `/api/employees/${employeeId}/employment-details`,
    details
  );
  return response.data;
}

export async function getProperty(propertyId: string): Promise<Property> {
  const client = getApiClient();
  return client.get<Property>(`/api/properties/${propertyId}`);
}

// ========== JOB STRUCTURE ==========

export async function getJobStructure(propertyId: string): Promise<JobStructure> {
  const client = getApiClient();
  const query = new URLSearchParams({ propertyId }).toString();
  return client.get<JobStructure>(`/api/settings/job-structure?${query}`);
}

export async function createDivision(payload: {
  propertyId: string;
  name: string;
  code?: string;
}): Promise<Division> {
  const client = getApiClient();
  return client.post<Division>('/api/settings/job-structure/divisions', payload);
}

export async function createDepartment(payload: {
  propertyId: string;
  divisionId: string;
  departmentCategoryId: string;
  name: string;
  code?: string;
}): Promise<Department> {
  const client = getApiClient();
  return client.post<Department>('/api/settings/job-structure/departments', payload);
}

export async function createJobRole(payload: {
  propertyId: string;
  departmentId: string;
  jobCategoryId: string;
  name: string;
  code?: string;
}): Promise<JobRole> {
  const client = getApiClient();
  return client.post<JobRole>('/api/settings/job-structure/jobs', payload);
}

export async function createJobAssignment(payload: {
  propertyId: string;
  jobRoleId: string;
  name: string;
  code?: string;
}): Promise<JobAssignment> {
  const client = getApiClient();
  return client.post<JobAssignment>('/api/settings/job-structure/assignments', payload);
}

export async function updateDivision(
  divisionId: string,
  payload: Partial<{ name: string; code?: string }>
): Promise<Division> {
  const client = getApiClient();
  return client.put<Division>(`/api/settings/job-structure/divisions/${divisionId}`, payload);
}

export async function updateDepartment(
  departmentId: string,
  payload: Partial<{
    name: string;
    code?: string;
    costCenter?: string;
    laborBudget?: number;
    location?: string;
    reportingGroupId?: string;
    managerId?: string;
  }>
): Promise<Department> {
  const client = getApiClient();
  return client.put<Department>(`/api/settings/job-structure/departments/${departmentId}`, payload);
}

export async function updateJobRole(
  jobRoleId: string,
  payload: Partial<{
    name: string;
    code?: string;
    payCode?: string;
    skillClassification?: string;
    unionClassification?: string;
    flsaStatus?: string;
    certificationRequirements?: string[];
  }>
): Promise<JobRole> {
  const client = getApiClient();
  return client.put<JobRole>(`/api/settings/job-structure/jobs/${jobRoleId}`, payload);
}

export async function updateJobAssignment(
  assignmentId: string,
  payload: Partial<{ name: string; code?: string; description?: string }>
): Promise<JobAssignment> {
  const client = getApiClient();
  return client.put<JobAssignment>(
    `/api/settings/job-structure/assignments/${assignmentId}`,
    payload
  );
}

// ========== TIME & ATTENDANCE ==========

export async function recordPunch(
  employeeId: string,
  type: 'in' | 'out' | 'break_start' | 'break_end',
  shiftId?: string
): Promise<Punch> {
  const client = getApiClient();
  return client.post<Punch>('/api/punches', {
    employeeId,
    type,
    shiftId,
  });
}

export async function getPunches(
  employeeId?: string,
  startDate?: string,
  endDate?: string
): Promise<Punch[]> {
  const client = getApiClient();
  const params = new URLSearchParams();
  if (employeeId) params.append('employeeId', employeeId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const query = params.toString();
  const response = await client.get<{ data: Punch[] }>(`/api/punches${query ? `?${query}` : ''}`);
  return response.data ?? [];
}

export async function getSchedules(): Promise<Schedule[]> {
  const client = getApiClient();
  const response = await client.get<{ data: Schedule[] }>('/api/schedules');
  return response.data ?? [];
}

export async function getExceptions(status?: string): Promise<Exception[]> {
  const client = getApiClient();
  const query = status ? `?status=${status}` : '';
  const response = await client.get<{ data: Exception[] }>(`/api/exceptions${query}`);
  return response.data ?? [];
}

export async function getException(exceptionId: string): Promise<Exception> {
  const client = getApiClient();
  return client.get<Exception>(`/api/exceptions/${exceptionId}`);
}

export async function resolveException(
  exceptionId: string,
  status: 'approved' | 'rejected',
  notes?: string
): Promise<Exception> {
  const client = getApiClient();
  return client.put<Exception>(`/api/exceptions/${exceptionId}/resolve`, {
    status,
    notes,
  });
}

// ========== LABOR COMPLIANCE ==========

export interface RulePackage {
  id: string;
  tenantId: string;
  propertyId?: string;
  name: string;
  description?: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED';
  sourceText?: string;
  compiledRules: CompiledRule[];
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
  publishedBy?: string;
}

export interface CompiledRule {
  id: string;
  rulePackageId: string;
  ruleId: string;
  name: string;
  description?: string;
  enabled: boolean;
  severity: 'ERROR' | 'WARN';
  params: Record<string, unknown>;
  citations?: Array<{
    sourceText: string;
    section?: string;
    lineNumber?: number;
  }>;
  clarifications?: Array<{
    clarification: string;
    context?: string;
  }>;
}

export async function compileComplianceText(params: {
  complianceText: string;
  context?: string;
  name?: string;
}): Promise<{ success: boolean; rulePackageId?: string; rules?: CompiledRule[]; message: string }> {
  const client = getApiClient();
  return client.post('/api/compliance/compile', params);
}

export async function publishRulePackage(
  rulePackageId: string,
  message?: string
): Promise<{ success: boolean; rulePackageId: string; version: number; message: string }> {
  const client = getApiClient();
  return client.post(`/api/compliance/publish/${rulePackageId}`, { message });
}

export async function listRulePackages(): Promise<{ packages: RulePackage[]; total: number }> {
  const client = getApiClient();
  return client.get('/api/compliance/packages');
}

export async function getRulePackage(rulePackageId: string): Promise<RulePackage> {
  const client = getApiClient();
  return client.get<RulePackage>(`/api/compliance/packages/${rulePackageId}`);
}

export async function validateRulePackage(params: {
  rulePackageId: string;
  employeeId?: string;
  dateStart: string;
  dateEnd: string;
}): Promise<{
  success: boolean;
  rulePackageId: string;
  dateRange: { start: string; end: string };
  results: Array<{
    employeeId: string;
    violationCount: number;
    hasErrors: boolean;
    hasWarnings: boolean;
    violations: unknown[];
    validationResultId: string;
  }>;
  totalViolations: number;
}> {
  const client = getApiClient();
  return client.post('/api/compliance/validate', params);
}

export async function clarifyRule(params: {
  ruleName: string;
  ruleDescription: string;
  sourceText?: string;
}): Promise<{ success: boolean; ruleName: string; clarification: string }> {
  const client = getApiClient();
  return client.post('/api/compliance/clarify', params);
}

// ========== Scheduling V2 ==========

export type ScheduleStatus = 'DRAFT' | 'PUBLISHED' | 'LOCKED';

export interface SchedulePeriod {
  id: string;
  tenantId: string;
  propertyId: string;
  startDate: string; // ISO datetime string
  endDate: string; // ISO datetime string
  status: ScheduleStatus;
  name?: string | null;
  planningTemplateId?: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  publishedAt?: string | null;
  publishedBy?: string | null;
  publishNotes?: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
}

export interface CreateSchedulePeriodParams {
  propertyId: string;
  startDate: string; // ISO datetime string
  endDate: string; // ISO datetime string
  name?: string;
  planningTemplateId?: string;
}

export interface PublishSchedulePeriodParams {
  id: string;
  notes?: string;
}

export interface LockSchedulePeriodParams {
  id: string;
}

export interface GetSchedulePeriodsParams {
  propertyId: string;
  start?: string; // ISO date string
  end?: string; // ISO date string
}

export async function getSchedulePeriods(
  params: GetSchedulePeriodsParams
): Promise<SchedulePeriod[]> {
  const client = getApiClient();
  const queryParams = new URLSearchParams({
    propertyId: params.propertyId,
    ...(params.start && { start: params.start }),
    ...(params.end && { end: params.end }),
  });
  const response = await client.get<{ success: boolean; data: SchedulePeriod[] }>(
    `/api/scheduling/v2/schedule-periods?${queryParams.toString()}`
  );
  return response.data || [];
}

export async function createSchedulePeriod(
  params: CreateSchedulePeriodParams
): Promise<SchedulePeriod> {
  const client = getApiClient();
  return client.post('/api/scheduling/v2/schedule-periods', params);
}

export async function publishSchedulePeriod(
  params: PublishSchedulePeriodParams
): Promise<SchedulePeriod> {
  const client = getApiClient();
  return client.post(`/api/scheduling/v2/schedule-periods/${params.id}/publish`, {
    notes: params.notes,
  });
}

export async function lockSchedulePeriod(
  params: LockSchedulePeriodParams
): Promise<SchedulePeriod> {
  const client = getApiClient();
  return client.post(`/api/scheduling/v2/schedule-periods/${params.id}/lock`, {});
}

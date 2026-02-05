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
    try {
      const authService = getAuthService();
      const token = authService.getAccessToken();
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        // Note: In dev mode with mock tokens, the backend will fetch the dev user from the database
        // so we don't need to send x-tenant-id and x-user-id headers
      }
    } catch {
      // Auth service not initialized, skip token attachment
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
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  hireDate?: string | null;
  isActive: boolean;
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

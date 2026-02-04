import { getAuthService } from './cognito-auth';

interface FetchOptions extends RequestInit {
  baseUrl?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make API request with automatic token attachment
   */
  async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const url = `${options.baseUrl || this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Attach authorization token if available
    try {
      const authService = getAuthService();
      const token = authService.getAccessToken();
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // Auth service not initialized, skip token attachment
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
  return client.get<Punch[]>(`/api/punches${query ? `?${query}` : ''}`);
}

export async function getSchedules(): Promise<Schedule[]> {
  const client = getApiClient();
  return client.get<Schedule[]>('/api/schedules');
}

export async function getExceptions(status?: string): Promise<Exception[]> {
  const client = getApiClient();
  const query = status ? `?status=${status}` : '';
  return client.get<Exception[]>(`/api/exceptions${query}`);
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

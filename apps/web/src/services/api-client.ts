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
        headers.Authorization = `Bearer ${token}`;
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

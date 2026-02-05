/**
 * Geocoding Service
 * Converts addresses to latitude/longitude for weather and timezone lookups
 * Routes through backend API to avoid CORS issues
 */

import { getApiClient } from './api-client';

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

/**
 * Geocode an address to get latitude/longitude
 * Calls backend endpoint which proxies to OpenStreetMap Nominatim
 */
export async function geocodeAddress(address: string): Promise<GeoLocation | null> {
  try {
    const apiClient = getApiClient();
    const response = await apiClient.get<GeoLocation>(
      `/api/geocode?address=${encodeURIComponent(address)}`
    );
    return response;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Get timezone name from latitude/longitude
 * Uses backend API to avoid CORS issues
 */
export async function getTimezoneFromLocation(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const apiClient = getApiClient();
    const url = `/api/timezone?lat=${latitude}&lng=${longitude}`;
    console.log('[Timezone Service] Requesting:', url);
    const data = await apiClient.get<{ zoneName: string }>(url);
    console.log('[Timezone Service] Response data:', data);

    if (data && data.zoneName) {
      console.log('[Timezone Service] Returning timezone:', data.zoneName);
      return data.zoneName;
    }

    // Fallback to browser timezone
    console.warn('[Timezone Service] No zoneName in response, using fallback');
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    // Fallback to browser timezone
    console.error('[Timezone Service] Error:', error);
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

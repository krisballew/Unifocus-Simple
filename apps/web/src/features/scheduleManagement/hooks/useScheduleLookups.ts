/**
 * Schedule Lookups Hook
 * Provides efficient caching and lookup of departments and job roles by ID
 */

import { useQueries } from '@tanstack/react-query';

import { getDepartments, getJobRoles } from '../api/lookups';
import type { DepartmentLookup, JobRoleLookup } from '../api/lookups';

export interface ScheduleLookups {
  departmentsById: Record<string, DepartmentLookup>;
  jobRolesById: Record<string, JobRoleLookup>;
  isLoading: boolean;
  isError: boolean;
}

export function useScheduleLookups(propertyId: string | null | undefined): ScheduleLookups {
  const queries = useQueries({
    queries: [
      {
        queryKey: ['schedule-lookups', propertyId, 'departments'],
        queryFn: () => getDepartments({ propertyId: propertyId! }),
        enabled: Boolean(propertyId),
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
      {
        queryKey: ['schedule-lookups', propertyId, 'jobRoles'],
        queryFn: () => getJobRoles({ propertyId: propertyId! }),
        enabled: Boolean(propertyId),
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
    ],
  });

  const departmentsQuery = queries[0];
  const jobRolesQuery = queries[1];

  // Build ID->Entity maps for O(1) lookups
  const departmentsById: Record<string, DepartmentLookup> = {};
  const jobRolesById: Record<string, JobRoleLookup> = {};

  if (departmentsQuery.data) {
    for (const dept of departmentsQuery.data) {
      departmentsById[dept.id] = dept;
    }
  }

  if (jobRolesQuery.data) {
    for (const role of jobRolesQuery.data) {
      jobRolesById[role.id] = role;
    }
  }

  return {
    departmentsById,
    jobRolesById,
    isLoading: departmentsQuery.isLoading || jobRolesQuery.isLoading,
    isError: departmentsQuery.isError || jobRolesQuery.isError,
  };
}

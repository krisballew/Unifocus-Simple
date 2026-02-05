/**
 * Custom React hooks for labor compliance rules system
 * Uses React Query (TanStack Query) for data fetching and mutations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  compileComplianceText,
  publishRulePackage,
  listRulePackages,
  getRulePackage,
  validateRulePackage,
  clarifyRule,
} from '../services/api-client';

// ============================================================================
// Query Keys
// ============================================================================

export const complianceQueryKeys = {
  all: ['compliance'],
  packages: ['compliance', 'packages'],
  package: (id: string) => ['compliance', 'packages', id],
  validationResults: ['compliance', 'validationResults'],
};

// ============================================================================
// Hooks for Rule Compilation
// ============================================================================

export function useCompileRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { complianceText: string; context?: string; name?: string }) =>
      compileComplianceText(params),
    onSuccess: () => {
      // Invalidate packages list since we created a new one
      queryClient.invalidateQueries({ queryKey: complianceQueryKeys.packages });
    },
  });
}

// ============================================================================
// Hooks for Rule Package Management
// ============================================================================

export function useListRulePackages() {
  return useQuery({
    queryKey: complianceQueryKeys.packages,
    queryFn: () => listRulePackages(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useRulePackage(packageId: string) {
  return useQuery({
    queryKey: complianceQueryKeys.package(packageId),
    queryFn: () => getRulePackage(packageId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function usePublishRulePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rulePackageId, message }: { rulePackageId: string; message?: string }) => {
      return publishRulePackage(rulePackageId, message);
    },
    onSuccess: (data) => {
      // Invalidate the specific package and the list
      queryClient.invalidateQueries({ queryKey: complianceQueryKeys.package(data.rulePackageId) });
      queryClient.invalidateQueries({ queryKey: complianceQueryKeys.packages });
    },
  });
}

// ============================================================================
// Hooks for Rule Validation
// ============================================================================

export function useValidateRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      rulePackageId: string;
      employeeId?: string;
      dateStart: string;
      dateEnd: string;
    }) => validateRulePackage(params),
    onSuccess: () => {
      // Invalidate validation results since we just ran a new validation
      queryClient.invalidateQueries({ queryKey: complianceQueryKeys.validationResults });
    },
  });
}

// ============================================================================
// Hooks for Rule Support
// ============================================================================

export function useClarifyRule() {
  return useMutation({
    mutationFn: (params: { ruleName: string; ruleDescription: string; sourceText?: string }) =>
      clarifyRule(params),
  });
}

// ============================================================================
// Custom Hooks for Common Patterns
// ============================================================================

/**
 * Hook that combines compile + publish workflow
 * Useful for "Compile and Publish" button
 */
export function useCompileAndPublishRules() {
  const compileRules = useCompileRules();
  const publishMutation = usePublishRulePackage();
  useQueryClient();

  const mutateAsync = async (params: {
    complianceText: string;
    context?: string;
    name?: string;
  }) => {
    // Step 1: Compile the rules
    const compileResult = await compileRules.mutateAsync(params);

    if (!compileResult.success || !compileResult.rulePackageId) {
      throw new Error(compileResult.message || 'Compilation failed');
    }

    // Step 2: Publish the package
    const publishResult = await publishMutation.mutateAsync({
      rulePackageId: compileResult.rulePackageId,
      message: `Published on ${new Date().toLocaleDateString()}`,
    });

    return {
      ...compileResult,
      ...publishResult,
    };
  };

  return {
    mutateAsync,
    isLoading: compileRules.isPending || publishMutation.isPending,
    isError: compileRules.isError || publishMutation.isError,
    error: compileRules.error || publishMutation.error,
  };
}

/**
 * Hook for batch validation across all employees
 */
export function useBatchValidateRules() {
  return useValidateRules();
}

/**
 * Hook to load a package and its rules
 */
export function useLoadRulePackageWithRules(packageId: string) {
  const { data: rulePackage, isLoading, error } = useRulePackage(packageId);

  return {
    rulePackage,
    rules: rulePackage?.compiledRules ?? [],
    isLoading,
    error,
  };
}

/**
 * Hook to get filtered rule packages by status
 */
export function useRulePackagesByStatus(status: 'DRAFT' | 'PUBLISHED') {
  const { data, isLoading, error } = useListRulePackages();

  const filtered = data?.packages?.filter((pkg) => pkg.status === status) ?? [];

  return {
    packages: filtered,
    isLoading,
    error,
    total: filtered.length,
  };
}

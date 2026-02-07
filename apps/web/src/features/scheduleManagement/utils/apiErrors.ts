/**
 * Error parsing and formatting utilities for Schedule Management API responses
 */

export interface ParsedApiError {
  status?: number;
  code?: string;
  message: string;
  details?: unknown;
}

/**
 * Parse an error from API response into a normalized structure
 * Handles:
 * - fetch errors thrown from api-client
 * - { success: false, error: {...} } payloads
 * - zod/validation shaped errors
 */
export function parseApiError(err: unknown): ParsedApiError {
  // Handle Error objects (thrown from fetch)
  if (err instanceof Error) {
    // Try to extract status from error message patterns
    const statusMatch = err.message.match(/API error: (\d{3})/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

    return {
      status,
      message: err.message,
    };
  }

  // Handle structured error responses { success: false, error: {...} }
  if (
    typeof err === 'object' &&
    err !== null &&
    'error' in err &&
    typeof err.error === 'object' &&
    err.error !== null
  ) {
    const errorObj = err.error as Record<string, unknown>;
    return {
      status:
        (errorObj.status as number | undefined) || (errorObj.statusCode as number | undefined),
      code: errorObj.code as string | undefined,
      message: (errorObj.message as string | undefined) || 'An error occurred',
      details: errorObj.details || errorObj.data,
    };
  }

  // Handle plain error objects
  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>;
    return {
      status:
        (errorObj.status as number | undefined) || (errorObj.statusCode as number | undefined),
      code: errorObj.code as string | undefined,
      message: (errorObj.message as string | undefined) || 'An error occurred',
      details: errorObj.details || errorObj.data,
    };
  }

  // Fallback for unknown error types
  return {
    message: String(err || 'An unknown error occurred'),
  };
}

/**
 * Format a parsed error into a user-friendly message specific to scheduling operations
 */
export function formatSchedulingMessage(parsed: ParsedApiError): string {
  const { status, message } = parsed;

  // 403 - Permission/locked period errors
  if (status === 403) {
    if (message.toLowerCase().includes('locked')) {
      return "This schedule period is locked. You can't modify it.";
    }
    return "You don't have permission to perform this action.";
  }

  // 409 - Business logic conflicts
  if (status === 409) {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('overlap') || lowerMsg.includes('conflict')) {
      return 'Assignment conflicts with an existing shift for that employee.';
    }
    if (lowerMsg.includes('eligible') || lowerMsg.includes('eligibility')) {
      return "Employee isn't eligible for this job role.";
    }
    if (lowerMsg.includes('open') && lowerMsg.includes('unavailable')) {
      return 'This open shift is no longer available.';
    }
    return 'This action conflicts with current schedule state.';
  }

  // 404 - Not found
  if (status === 404) {
    return 'The requested resource was not found. It may have been deleted.';
  }

  // 400 - Validation errors
  if (status === 400) {
    // Return the original message if it looks like a validation error
    if (
      message.includes('required') ||
      message.includes('invalid') ||
      message.includes('must be')
    ) {
      return message;
    }
    return 'Invalid request. Please check your input and try again.';
  }

  // 500 - Server errors
  if (status && status >= 500) {
    return 'Server error. Please try again in a few moments.';
  }

  // Network/unknown errors
  if (!status) {
    if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
  }

  // Default: return the message as-is if it's already user-friendly
  return message || 'An unexpected error occurred.';
}

/**
 * Convenience function that both parses and formats an error
 */
export function formatApiError(err: unknown): string {
  const parsed = parseApiError(err);
  return formatSchedulingMessage(parsed);
}

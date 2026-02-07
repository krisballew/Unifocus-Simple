/**
 * Scheduling V2 Module
 * Enterprise scheduling implementation with organizational scope enforcement
 *
 * @module scheduling/v2
 */

// Export types and DTOs
export * from './dtos.js';

// Export permissions
export * from './permissions.js';

// Export validators
export * from './validators.js';

// Export org-scope adapter
export * from './org-scope-adapter.js';

// Export guard (authorization helpers)
export * from './guard.js';

// Export service
export * from './scheduling-v2-service.js';

// Export routes
export * from './routes.js';

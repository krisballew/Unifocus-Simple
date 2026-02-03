/**
 * CloudFront Function to add security headers to all responses
 * Runs on viewer-response event to add security headers
 * @param {Object} event - CloudFront event object
 * @returns {Object} Response with security headers
 */
// This function is used by CloudFront, not directly in the codebase
// eslint-disable-next-line import/no-unused-modules
exports.handler = function handler(event) {
  const response = event.response;
  const headers = response.headers;

  // Strict-Transport-Security
  headers['strict-transport-security'] = {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  };

  // X-Content-Type-Options
  headers['x-content-type-options'] = {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  };

  // X-Frame-Options
  headers['x-frame-options'] = {
    key: 'X-Frame-Options',
    value: 'DENY',
  };

  // X-XSS-Protection
  headers['x-xss-protection'] = {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  };

  // Referrer-Policy
  headers['referrer-policy'] = {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  };

  // Content-Security-Policy
  // Allow:
  // - self for scripts, styles, fonts, images
  // - Cognito endpoints for authentication
  // - API endpoint for data
  // - https: for images and other resources
  headers['content-security-policy'] = {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'", // Required for React
      "style-src 'self' 'unsafe-inline'", // Vite inlines critical styles
      "font-src 'self' data:",
      "img-src 'self' https: data:",
      "connect-src 'self' https://*.cognito-idp.*.amazonaws.com https://*.cognito-identity.*.amazonaws.com",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  };

  // Permissions-Policy (formerly Feature-Policy)
  headers['permissions-policy'] = {
    key: 'Permissions-Policy',
    value: 'geolocation=(), microphone=(), camera=()',
  };

  return response;
};

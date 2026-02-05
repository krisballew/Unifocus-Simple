import React, { useEffect, useState } from 'react';

import { getAuthService } from '../services/cognito-auth';

export interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if we're returning from Cognito with auth code
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      handleCallback(code);
    }
  }, []);

  const handleCallback = async (code: string) => {
    setIsLoading(true);
    try {
      const authService = getAuthService();
      await authService.handleCallback(code);

      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);

      onLoginSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsLoading(false);
    }
  };

  const handleLoginClick = () => {
    console.log('[LoginPage] ========== LOGIN BUTTON CLICKED ==========');
    console.log('[LoginPage] Login button clicked');
    try {
      const authService = getAuthService();
      console.log('[LoginPage] Auth service obtained, calling redirectToLogin()');
      authService.redirectToLogin();
    } catch (err) {
      console.error('[LoginPage] Login error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate login');
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Logging you in...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Unifocus</h1>
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
          Time & Attendance Management
        </p>

        {error && (
          <div
            style={{
              backgroundColor: '#fee',
              color: '#c00',
              padding: '1rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleLoginClick}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '1rem',
          }}
        >
          Login with Cognito
        </button>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#999' }}>
          You will be redirected to the Cognito login page
        </p>
      </div>
    </div>
  );
}

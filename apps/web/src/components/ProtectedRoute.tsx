import React, { useEffect, useState } from 'react';

import { getAuthService } from '../services/cognito-auth';

import { LoginPage } from './LoginPage';

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps): React.ReactElement {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const authService = getAuthService();
      setIsAuthenticated(authService.isAuthenticated());
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  if (isAuthenticated === null) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

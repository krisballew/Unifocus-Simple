import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { getCurrentUser } from '../services/api-client';
import { getAuthService } from '../services/cognito-auth';
import { queryKeys } from '../services/query-keys';

export interface AuthenticatedRouteProps {
  children: React.ReactNode;
}

export function AuthenticatedRoute({ children }: AuthenticatedRouteProps): React.ReactElement {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setIsAuthenticated(getAuthService().isAuthenticated());
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  const userQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
    enabled: Boolean(isAuthenticated),
  });

  if (isAuthenticated === null || userQuery.isLoading) {
    return <LoadingSkeleton lines={6} card />;
  }

  if (!isAuthenticated || userQuery.isError) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

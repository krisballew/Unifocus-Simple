import { useEffect, useState } from 'react';

import type { User } from '../services/api-client';
import { getCurrentUser } from '../services/api-client';
import { getAuthService } from '../services/cognito-auth';

export interface UseAuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function useAuth(): UseAuthState {
  const [state, setState] = useState<UseAuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        const authService = getAuthService();
        const isAuth = authService.isAuthenticated();

        if (isAuth) {
          const user = await getCurrentUser();
          setState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: error instanceof Error ? error : new Error('Auth check failed'),
        });
      }
    };

    initAuth();
  }, []);

  return state;
}

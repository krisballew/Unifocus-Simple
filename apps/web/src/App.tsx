import type { User } from '@unifocus/contracts';
import { translate } from '@unifocus/i18n';
import { Button } from '@unifocus/ui';
import { useEffect, useState } from 'react';

import { LoginPage } from './components/LoginPage';
import { initializeApiClient, getCurrentUser } from './services/api-client';
import { initializeCognitoAuth, getAuthService } from './services/cognito-auth';

interface CurrentUser {
  userId: string;
  email: string;
  username: string;
  tenantId?: string;
  roles: string[];
  scopes: string[];
}

export function App() {
  const [count, setCount] = useState(0);
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [users, setUsers] = useState<User[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    // Initialize Cognito auth
    const cognitoConfig = {
      region: import.meta.env.VITE_COGNITO_REGION || 'us-east-1',
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
      domain: import.meta.env.VITE_COGNITO_DOMAIN || '',
      redirectUri:
        import.meta.env.VITE_COGNITO_REDIRECT_URI || 'http://localhost:5173/auth/callback',
      logoutUri: import.meta.env.VITE_COGNITO_LOGOUT_URI || 'http://localhost:5173/login',
    };

    try {
      initializeCognitoAuth(cognitoConfig);
    } catch (error) {
      console.error('Failed to initialize Cognito:', error);
    }

    // Initialize API client
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    try {
      initializeApiClient(apiBaseUrl);
    } catch (error) {
      console.error('Failed to initialize API client:', error);
    }

    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    // Fetch current user
    const fetchCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to fetch current user:', error);
      }
    };

    fetchCurrentUser();
  }, [isInitialized]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/users');
      const data = (await response.json()) as { data: User[] };
      setUsers(data.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleLogout = () => {
    try {
      const authService = getAuthService();
      authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
      localStorage.removeItem('auth_tokens');
      window.location.href = '/login';
    }
  };

  if (!isInitialized) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Initializing...</div>;
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={() => window.location.reload()} />;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <div
        style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1>{translate(lang, 'welcome')} to Unifocus Simple</h1>
        <div>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
            Logged in as: {currentUser.email}
          </p>
          <Button
            onClick={handleLogout}
            variant="secondary"
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            Logout
          </Button>
        </div>
      </div>

      <p>Count: {count}</p>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Button onClick={() => setCount(count + 1)}>Increment</Button>
        <Button onClick={() => setCount(0)} variant="secondary">
          Reset
        </Button>
        <Button onClick={() => setLang(lang === 'en' ? 'es' : 'en')} variant="secondary">
          Toggle Language ({lang})
        </Button>
        <Button onClick={fetchUsers} variant="secondary">
          Fetch Users
        </Button>
      </div>
      {users.length > 0 && (
        <div>
          <h2>Users</h2>
          <ul>
            {users.map((user) => (
              <li key={user.id}>
                {user.firstName} {user.lastName} - {user.email}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

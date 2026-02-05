import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { LoginPage } from './components/LoginPage';
import { I18nProvider } from './context/I18nContext';
import { EmployeesPage } from './pages/EmployeesPage';
import { ExceptionsQueuePage } from './pages/ExceptionsQueuePage';
import { HomePage } from './pages/HomePage';
import { HrManagementPage } from './pages/HrManagementPage';
import { NewLoginPage } from './pages/NewLoginPage';
import { NotFound } from './pages/NotFound';
import { OrgStructurePage } from './pages/OrgStructurePage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { RegisterPage } from './pages/RegisterPage';
import { TimecardPage } from './pages/TimecardPage';
import { TimeClockPage } from './pages/TimeClockPage';
import { UserAdministrationPage } from './pages/UserAdministrationPage';
import { AuthenticatedRoute } from './routes/AuthenticatedRoute';
import { initializeApiClient } from './services/api-client';
import { initializeCognitoAuth } from './services/cognito-auth';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<NewLoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<LoginPage />} />
      <Route
        element={
          <AuthenticatedRoute>
            <AppShell />
          </AuthenticatedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="time-clock" element={<TimeClockPage />} />
        <Route path="timecard" element={<TimecardPage />} />
        <Route path="exceptions" element={<ExceptionsQueuePage />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="hr-management" element={<HrManagementPage />} />
        <Route path="org-structure" element={<OrgStructurePage />} />
        <Route path="schedules" element={<PlaceholderPage title="Schedules" />} />
        <Route path="tasks" element={<PlaceholderPage title="Tasks" />} />
        <Route path="profile" element={<UserAdministrationPage />} />
        <Route path="settings" element={<PlaceholderPage title="System Settings" />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      const cognitoConfig = {
        region: import.meta.env.VITE_COGNITO_REGION || 'us-east-1',
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
        clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
        domain: import.meta.env.VITE_COGNITO_DOMAIN || '',
        redirectUri:
          import.meta.env['VITE_COGNITO_REDIRECT_URI'] || 'http://localhost:3000/auth/callback',
        logoutUri: import.meta.env['VITE_COGNITO_LOGOUT_URI'] || 'http://localhost:3000/login',
      };

      try {
        initializeCognitoAuth(cognitoConfig);
      } catch (error) {
        console.error('Failed to initialize Cognito:', error);
      }

      // Determine API base URL with smart detection
      let apiBaseUrl = import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:3001';

      if (import.meta.env.DEV) {
        // In development, try multiple API endpoints in order of preference:
        // 1. Configured API URL (http://localhost:3001)
        // 2. Localhost with any port
        // 3. Relative /api proxy (for Codespaces/remote access with Vite proxy)

        const apiUrls = [apiBaseUrl, 'http://localhost:3001'];

        let finalUrl: string | null = null;

        for (const url of apiUrls) {
          try {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`${url}/health`, {
              method: 'HEAD',
              signal: controller.signal,
            }).catch(() => null);

            window.clearTimeout(timeoutId);

            if (response && response.ok) {
              finalUrl = url;
              console.log(`✓ API verified at ${url}`);
              break;
            }
          } catch (error) {
            // Continue to next URL
          }
        }

        // If no direct API URL worked, use /api proxy (works with Vite proxy or remote servers)
        if (!finalUrl) {
          console.log('Using /api proxy for API requests');
          apiBaseUrl = '/api';
        } else {
          apiBaseUrl = finalUrl;
        }
      }

      try {
        initializeApiClient(apiBaseUrl);
        console.log(`API client initialized with ${apiBaseUrl}`);
      } catch (error) {
        console.error('Failed to initialize API client:', error);
      }

      setIsInitialized(true);
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return <LoadingSkeleton lines={5} card />;
  }

  return (
    <I18nProvider>
      <AppRoutes />
    </I18nProvider>
  );
}
